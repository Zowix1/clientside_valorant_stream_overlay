import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_HENRIK_BASE ?? '/henrik';

const BUDGET_RPM = 25; // henrik api limit
const REQ_PER_POLL = 2; // matches + mmr
const FLOOR_SECONDS = 10; // never go below this
const HEADROOM = 0.7; // use 70% of budget to avoid 429s & bursts
const PHASE_MIN_MS = 200;
const PHASE_MAX_MS = 1500; // cap so first hit isn't too delayed

export function computeSafePollMs({
  accounts = 1,
  budgetRpm = BUDGET_RPM,
  reqPerPoll = REQ_PER_POLL,
  headroom = HEADROOM,
  retryPad = 0.2, // + in % request padding for occasional retries/extra endpoints
  safetyPad = 0.9, // an extra 10% margin on top of headroom
} = {}) {
  const n = Math.max(1, Number(accounts) || 1);
  const effectiveRpm = Math.max(1, budgetRpm * headroom * safetyPad);
  const adjustedReqPerPoll = Math.max(1, reqPerPoll * (1 + retryPad));
  const requiredSeconds = Math.ceil((n * adjustedReqPerPoll * 60) / effectiveRpm);
  return Math.max(FLOOR_SECONDS, requiredSeconds) * 1000;
}

function nextDelayWithBackoff(baseMs, attempt, retryAfterSec) {
  if (Number.isFinite(retryAfterSec)) return Math.max(1000, retryAfterSec * 1000);
  const max = 30000;
  const exp = Math.min(baseMs * 2 ** attempt, max);
  const jitter = exp * (0.2 * Math.random()); // +-20%
  return Math.round(exp * 0.9 + jitter);
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dayKeyFromMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function randInt(max) {
  // crypto if available else Math.random
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const u32 = new Uint32Array(1);
    crypto.getRandomValues(u32);
    return u32[0] % (max + 1);
  }
  return Math.floor(Math.random() * (max + 1));
}

/** ---------- OBS-safe localStorage helpers ---------- */
function getSafeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__obs_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}
const safeStore = getSafeStorage();

function makeCacheKey({ apiKey, region, puuid, name, tag }) {
  const id = puuid || `${name || ''}#${tag || ''}`;
  const keyFrag = (apiKey || '').slice(0, 6);
  return `henrik:stats:${region}:${id}:${keyFrag}`;
}
function loadCache(key, maxAgeMs = 30 * 60 * 1000) {
  if (!safeStore) return null;
  try {
    const raw = safeStore.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (Date.now() - (obj.ts || 0) > maxAgeMs) return null;
    return obj.data || null;
  } catch {
    return null;
  }
}
function saveCache(key, data) {
  if (!safeStore) return;
  try {
    safeStore.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}
/** --------------------------------------------------- */

// shallow compare only the fields you render
function equalPayload(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.wins === b.wins &&
    a.losses === b.losses &&
    a.kills === b.kills &&
    a.deaths === b.deaths &&
    a.currentRR === b.currentRR &&
    a.recentRRChange === b.recentRRChange &&
    a.image === b.image
  );
}

export default function useHenrikStats({
  apiKey,
  region,
  puuid, // OR
  name,
  tag,
  pollMs, // optional
  accounts = 1,
}) {
  const [data, setData] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false); // cached due to 429
  const [mmrStale, setMmrStale] = useState(false); // MMR-only failure this tick

  const stopRef = useRef(false);
  const attemptRef = useRef(0);
  const axiosRef = useRef(null);
  const idRef = useRef({ puuid: null });
  const timerRef = useRef(null);

  const seenMatchIdsRef = useRef(new Set());
  const totalsRef = useRef({ wins: 0, losses: 0, kills: 0, deaths: 0 });
  const dayKeyRef = useRef(dayKeyFromMs(startOfTodayMs()));
  const todayStartRef = useRef(startOfTodayMs());

  const lastGoodRef = useRef(null);
  const lastCommittedRef = useRef(null);
  const cacheKeyRef = useRef(null);
  const loadedOnceRef = useRef(false);

  // state commit helper
  function commitIfChanged(payload, { mmrUpdated = true } = {}) {
    const prev = lastCommittedRef.current;
    const changed = !equalPayload(prev, payload);

    if (changed) {
      lastCommittedRef.current = payload;
      setData(payload);
    }

    if (mmrUpdated && changed) {
      lastGoodRef.current = payload;
      saveCache(cacheKeyRef.current, payload);
    }
  }

  useEffect(() => {
    stopRef.current = false;
    setLoading(true);
    loadedOnceRef.current = false;
    setError(null);
    setStale(false);
    setMmrStale(false);

    // reset daily monotonic state when identity changes
    seenMatchIdsRef.current = new Set();
    totalsRef.current = { wins: 0, losses: 0, kills: 0, deaths: 0 };
    dayKeyRef.current = dayKeyFromMs(startOfTodayMs());
    todayStartRef.current = startOfTodayMs();
    lastCommittedRef.current = null;

    if (!apiKey) {
      setError(new Error('Missing API key'));
      setLoading(false);
      return;
    }
    if (!region) {
      setError(new Error('Missing region'));
      setLoading(false);
      return;
    }

    axiosRef.current = axios.create({
      baseURL: BASE,
      headers: { Authorization: apiKey },
      timeout: 15000,
    });

    // warm cache
    cacheKeyRef.current = makeCacheKey({ apiKey, region, puuid, name, tag });
    const cached = loadCache(cacheKeyRef.current);
    if (cached) {
      lastGoodRef.current = cached;
      lastCommittedRef.current = cached;
      setData(cached);
      setStale(true); // until first fresh success
      setLoading(false);
      loadedOnceRef.current = true;
    }

    async function resolvePuuid() {
      if (puuid) {
        idRef.current = { puuid };
        return puuid;
      }
      if (name && tag) {
        const res = await axiosRef.current.get(
          `/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
        );
        const P = res.data?.data?.puuid;
        if (!P) throw new Error('Failed to resolve PUUID from name#tag');
        idRef.current = { puuid: P };
        return P;
      }
      throw new Error('Provide either PUUID or name+tag');
    }

    function maybeRollDay() {
      const nowStart = startOfTodayMs();
      const nowKey = dayKeyFromMs(nowStart);
      if (nowKey !== dayKeyRef.current) {
        dayKeyRef.current = nowKey;
        todayStartRef.current = nowStart;
        seenMatchIdsRef.current = new Set();
        totalsRef.current = { wins: 0, losses: 0, kills: 0, deaths: 0 };
      }
    }

    function tallyMatchIfNew(m, P) {
      const id = m?.metadata?.matchid;
      if (!id || seenMatchIdsRef.current.has(id)) return;
      if (m?.metadata?.mode_id !== 'competitive') return;
      const startMs = (m?.metadata?.game_start ?? 0) * 1000;
      if (startMs < todayStartRef.current) return;
      const you = m?.players?.all_players?.find((p) => p?.puuid === P);
      if (!you) return;
      const teamKey = you.team?.toLowerCase?.();
      const team = m?.teams?.[teamKey];
      if (typeof team?.has_won !== 'boolean') return;

      const t = totalsRef.current;
      if (team.has_won) t.wins += 1;
      else t.losses += 1;
      t.kills += you?.stats?.kills ?? 0;
      t.deaths += you?.stats?.deaths ?? 0;

      seenMatchIdsRef.current.add(id);
    }

    async function fetchOnce() {
      try {
        const P = idRef.current.puuid || (await resolvePuuid());
        setMmrStale(false); // reset per tick
        maybeRollDay();

        // Matches
        const mh = await axiosRef.current.get(`/valorant/v3/by-puuid/matches/${region}/${P}`, {
          params: { size: 10, mode: 'competitive' },
        });
        const matches = Array.isArray(mh.data?.data) ? mh.data.data : [];
        matches
          .slice()
          .sort((a, b) => (a?.metadata?.game_start ?? 0) - (b?.metadata?.game_start ?? 0))
          .forEach((m) => tallyMatchIfNew(m, P));

        // MMR (best-effort). If it fails, reuse cached MMR fields.
        let currentRR, recentRRChange, image;
        let mmrFailed = false;
        try {
          const mmr = await axiosRef.current.get(`/valorant/v2/by-puuid/mmr/${region}/${P}`);
          const cd = mmr.data?.data?.current_data ?? {};
          currentRR = cd.ranking_in_tier ?? null;
          recentRRChange = cd.mmr_change_to_last_game ?? null;
          image = cd?.images?.large ?? cd?.images?.small ?? null;
        } catch {
          mmrFailed = true;
          const lg = lastGoodRef.current;
          currentRR = lg?.currentRR ?? null;
          recentRRChange = lg?.recentRRChange ?? null;
          image = lg?.image ?? null;
        }

        const { wins, losses, kills, deaths } = totalsRef.current;
        const payload = { wins, losses, kills, deaths, currentRR, recentRRChange, image };

        // Only persist to cache when MMR succeeded
        if (!mmrFailed) {
          commitIfChanged(payload, { mmrUpdated: true });
        } else {
          // Update UI if changed, but don't replace lastGoodRef/cache
          if (!equalPayload(lastCommittedRef.current, payload)) {
            lastCommittedRef.current = payload;
            setData(payload);
          }
        }

        setMmrStale((prev) => (prev === mmrFailed ? prev : mmrFailed));
        setStale((prev) => (prev ? false : prev));
        if (!loadedOnceRef.current) {
          setLoading(false);
          loadedOnceRef.current = true;
        }
        setError(null);
        attemptRef.current = 0;
        return { ok: true };
      } catch (e) {
        const status = e?.response?.status;
        const retryAfter = parseFloat(e?.response?.headers?.['retry-after']);

        // On 429, keep showing last good (if any) and mark stale
        if (status === 429 && lastGoodRef.current) {
          if (!equalPayload(lastCommittedRef.current, lastGoodRef.current)) {
            lastCommittedRef.current = lastGoodRef.current;
            setData(lastGoodRef.current);
          }
          setStale((prev) => (prev ? prev : true));
          if (!loadedOnceRef.current) {
            setLoading(false);
            loadedOnceRef.current = true;
          }
          setError(e);
        } else {
          setError(e);
          if (!loadedOnceRef.current) {
            setLoading(false);
            loadedOnceRef.current = true;
          }
        }
        return { ok: false, status, retryAfter };
      }
    }

    const baseDelay = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : computeSafePollMs({ accounts });

    async function loop() {
      if (stopRef.current) return;
      const res = await fetchOnce();
      if (stopRef.current) return;

      let delay = baseDelay;

      if (!res.ok) {
        const a = attemptRef.current++;
        delay = nextDelayWithBackoff(delay, a, res.retryAfter);
      } else {
        attemptRef.current = 0;
      }

      const jitter = delay * (0.1 * Math.random());
      const next = Math.round(delay * 0.95 + jitter);

      timerRef.current = setTimeout(loop, next);
    }

    const targetPhase = Math.min(PHASE_MAX_MS, Math.max(PHASE_MIN_MS, Math.round(baseDelay * 0.1)));
    const phase = Math.max(PHASE_MIN_MS, Math.min(PHASE_MAX_MS, randInt(targetPhase)));

    timerRef.current = setTimeout(loop, phase);

    return () => {
      stopRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [apiKey, region, puuid, name, tag, pollMs, accounts]);

  return { data, error, isLoading, stale, mmrStale };
}

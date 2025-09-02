import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_HENRIK_BASE ?? '/henrik';
const BUDGET_RPM = 25;

// 2 requests per poll (matches + mmr)
export function computeSafePollMs(accounts = 1, budgetRpm = BUDGET_RPM) {
  const n = Math.max(1, Number(accounts) || 1);
  const minSecondsByBudget = (n * 120) / budgetRpm;
  const finalSeconds = Math.max(10, Math.ceil(minSecondsByBudget));
  return finalSeconds * 1000;
}

function nextDelayWithBackoff(baseMs, attempt, retryAfterSec) {
  if (Number.isFinite(retryAfterSec)) return Math.max(1000, retryAfterSec * 1000);
  const max = 30000;
  const exp = Math.min(baseMs * 2 ** attempt, max);
  const jitter = exp * (0.2 * Math.random()); // ±20%
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

export default function useHenrikStats({
  apiKey,
  region,
  puuid, // OR
  name,
  tag,
  pollMs, // optional
}) {
  const [data, setData] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const stopRef = useRef(false);
  const attemptRef = useRef(0);
  const axiosRef = useRef(null);
  const idRef = useRef({ puuid: null });
  const timerRef = useRef(null);

  const seenMatchIdsRef = useRef(new Set());
  const totalsRef = useRef({ wins: 0, losses: 0, kills: 0, deaths: 0 });
  const dayKeyRef = useRef(dayKeyFromMs(startOfTodayMs()));
  const todayStartRef = useRef(startOfTodayMs());

  useEffect(() => {
    stopRef.current = false;
    setLoading(true);
    setError(null);

    // reset daily monotonic state when identity changes
    seenMatchIdsRef.current = new Set();
    totalsRef.current = { wins: 0, losses: 0, kills: 0, deaths: 0 };
    dayKeyRef.current = dayKeyFromMs(startOfTodayMs());
    todayStartRef.current = startOfTodayMs();

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

      // Only count finished matches – prevents “loss” flicker for in-progress games
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

        maybeRollDay();

        // Pull enough items so we catch earlier matches if overlay is opened late
        const mh = await axiosRef.current.get(`/valorant/v3/by-puuid/matches/${region}/${P}`, { params: { size: 30 } });
        const matches = Array.isArray(mh.data?.data) ? mh.data.data : [];

        matches
          .slice()
          .sort((a, b) => (a?.metadata?.game_start ?? 0) - (b?.metadata?.game_start ?? 0))
          .forEach((m) => tallyMatchIfNew(m, P));

        // MMR
        let currentRR = null,
          recentRRChange = null,
          image = null;
        try {
          const mmr = await axiosRef.current.get(`/valorant/v2/by-puuid/mmr/${region}/${P}`);
          const cd = mmr.data?.data?.current_data ?? {};
          currentRR = cd.ranking_in_tier ?? null;
          recentRRChange = cd.mmr_change_to_last_game ?? null;
          image = cd?.images?.large ?? cd?.images?.small ?? null;
        } catch (e) {
          console.warn('MMR failed', e?.response?.status || e?.message);
        }

        const { wins, losses, kills, deaths } = totalsRef.current;
        setData({ wins, losses, kills, deaths, currentRR, recentRRChange, image });
        setError(null);
        setLoading(false);
        attemptRef.current = 0;
        return { ok: true };
      } catch (e) {
        setError(e);
        setLoading(false);
        return {
          ok: false,
          status: e?.response?.status,
          retryAfter: parseFloat(e?.response?.headers?.['retry-after']),
        };
      }
    }

    async function loop() {
      if (stopRef.current) return;
      const res = await fetchOnce();
      if (stopRef.current) return;

      const baseDelay = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : computeSafePollMs(1); // keep 10s floor
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

    loop();
    return () => {
      stopRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [apiKey, region, puuid, name, tag, pollMs]);

  return { data, error, isLoading };
}

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_HENRIK_BASE ?? '/henrik';

// safe requests/min budget (keep below 30 for headroom)
const BUDGET_RPM = 25;

// 2 requests per poll (matches + mmr)
export function computeSafePollMs(accounts = 1, budgetRpm = BUDGET_RPM) {
  const n = Math.max(1, Number(accounts) || 1);
  const minSecondsByBudget = (n * 120) / budgetRpm; // from rate math
  const finalSeconds = Math.max(10, Math.ceil(minSecondsByBudget)); // 10s floor
  return finalSeconds * 1000;
}

function nextDelayWithBackoff(baseMs, attempt, retryAfterSec) {
  if (Number.isFinite(retryAfterSec)) return Math.max(1000, retryAfterSec * 1000);
  const max = 30000;
  const exp = Math.min(baseMs * 2 ** attempt, max);
  const jitter = exp * (0.2 * Math.random()); // ± 20%
  return Math.round(exp * 0.9 + jitter);
}

export default function useHenrikStatsAxios({
  apiKey,
  region,
  puuid, // OR
  name,
  tag,
  pollMs, // optional override; if omitted, you should pass accounts to compute it outside
}) {
  const [data, setData] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const stopRef = useRef(false);
  const attemptRef = useRef(0);
  const axiosRef = useRef(null);
  const idRef = useRef({ puuid: null });
  const timerRef = useRef(null);

  useEffect(() => {
    stopRef.current = false;
    setLoading(true);
    setError(null);
    setData(null);
    attemptRef.current = 0;

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

    // axios instance with key
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

    async function fetchOnce() {
      try {
        const P = idRef.current.puuid || (await resolvePuuid());

        // matches (size=20)
        const mh = await axiosRef.current.get(`/valorant/v3/by-puuid/matches/${region}/${P}`, { params: { size: 20 } });
        const matches = mh.data?.data ?? [];

        // "today" window (local time)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startMs = startOfDay.getTime();

        let wins = 0,
          losses = 0,
          kills = 0,
          deaths = 0;
        for (const m of matches) {
          if (m?.metadata?.mode_id !== 'competitive') continue;
          const t = (m?.metadata?.game_start ?? 0) * 1000;
          if (t < startMs) continue;
          const you = m?.players?.all_players?.find((p) => p?.puuid === P);
          if (!you) continue;
          const team = m?.teams?.[you.team?.toLowerCase?.() ?? ''];
          team?.has_won ? wins++ : losses++;
          kills += you?.stats?.kills ?? 0;
          deaths += you?.stats?.deaths ?? 0;
        }

        // MMR (tolerate failure)
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
          // swallow; backoff handled by outer loop timing
          console.warn('MMR failed', e.response?.status || e.message);
        }

        setData({ wins, losses, kills, deaths, currentRR, recentRRChange, image });
        setError(null);
        setLoading(false);
        attemptRef.current = 0; // reset backoff
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

      const baseDelay = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : computeSafePollMs(1); // 10s floor
      let delay = baseDelay;

      if (!res.ok) {
        const a = attemptRef.current++;
        delay = nextDelayWithBackoff(delay, a, res.retryAfter);
      } else {
        attemptRef.current = 0;
      }
      // add small jitter to avoid sync bursts across overlays
      const jitter = delay * (0.1 * Math.random());
      const next = Math.round(delay * 0.95 + jitter);

      timerRef.current = setTimeout(loop, next);
    }

    loop();
    return () => {
      stopRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // re-run when key/identity/poll changes
  }, [apiKey, region, puuid, name, tag, pollMs]);

  return { data, error, isLoading };
}

import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiLoader, FiAlertCircle, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import useHenrikStats, { computeSafePollMs } from '../hooks/useHenrikStats';
import WaveNumber from './WaveNumber';
import LightningOverlay from './LightningOverlay';

const clampInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

function clamp01(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

function hexToRgba(hex, a = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${a})`;
  let h = hex.trim();
  if (h === 'transparent') return 'transparent';
  if (h.startsWith('#')) h = h.slice(1);
  // Support #RGB, #RRGGBB
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  // If hex already includes alpha (#RRGGBBAA), prefer that and ignore separate a
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const aa = parseInt(h.slice(6, 8), 16) / 255;
    return aa >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${aa})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return a >= 1 ? hex : `rgba(0,0,0,${a})`;
}

function Tracker() {
  const [params] = useSearchParams();

  // API + polling
  const apiKey = params.get('key') || '';
  const region = params.get('region') || '';
  const accounts = Math.max(1, Number(params.get('accounts')) || 1);
  const pollMs = computeSafePollMs({ accounts });

  const puuid = params.get('puuid') || undefined;
  const name = params.get('name') || undefined;
  const tag = params.get('tag') || undefined;

  const { data, error, isLoading } = useHenrikStats({ apiKey, region, puuid, name, tag, pollMs, accounts });

  // Customization: card colors + text
  const bgParam = (params.get('bg') || '#111827').trim();
  const bgAlpha = clamp01(params.get('bga') ?? 1);
  const cardBg = bgParam === 'transparent' || bgAlpha === 0 ? 'transparent' : hexToRgba(bgParam, bgAlpha);
  const textHex = params.get('text') || '#FFFFFF';

  // Waves toggle
  const wavesEnabled = (params.get('waves') ?? '1') === '1';

  // Lightning options
  const lightEnabled = (params.get('light') ?? '1') === '1';
  const lInterval = clampInt(params.get('lint') ?? 20000, 200, 120000);
  const lBoltCount = clampInt(params.get('lbolts') ?? 1, 0, 8);
  const lDuration = clampInt(params.get('ldur') ?? 1200, 100, 6000);
  const lSegments = clampInt(params.get('lseg') ?? 14, 4, 60);
  const lJitter = clampInt(params.get('ljit') ?? 6, 0, 40);

  // Missing params message
  if (!apiKey || !region || (!puuid && !(name && tag))) {
    return (
      <div
        className='w-[360px] h-24 text-white flex items-center justify-center rounded'
        style={{ backgroundColor: cardBg, color: textHex }}>
        <div className='text-center text-xs px-3'>
          Missing params. Provide <strong>key</strong>, <strong>region</strong>, and either <strong>puuid</strong> or{' '}
          <strong>name+tag</strong>.
        </div>
      </div>
    );
  }

  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
  }, []);

  const rrNum = Number(data?.recentRRChange ?? 0);
  const isGain = rrNum >= 0;
  const Icon = isGain ? FiTrendingUp : FiTrendingDown;
  const color = isGain ? 'text-green-400' : 'text-red-400';

  const status = data && data.wins > data.losses ? 'winning' : data && data.wins < data.losses ? 'losing' : 'even';

  return (
    <div
      ref={containerRef}
      className='w-full relative h-24 p-4 flex flex-col justify-between'
      style={{ backgroundColor: cardBg, color: textHex }}>
      {isLoading ? (
        <div className='flex items-center justify-center space-x-2 animate-pulse'>
          <FiLoader className='w-6 h-6 animate-spin text-blue-400' />
          <span>Loading…</span>
        </div>
      ) : error ? (
        <div className='flex flex-col items-center justify-center space-y-1'>
          <FiAlertCircle className='w-6 h-6 text-red-500' />
          <span className='text-sm'>Failed to load</span>
          <span className='text-[11px] text-gray-400'>
            {error?.message || 'Check key / region / account & rate limit'}
          </span>
        </div>
      ) : (
        <>
          {/* Lightning overlay (configurable) */}
          {size.w > 0 && lightEnabled && (
            <LightningOverlay
              status={status}
              interval={lInterval}
              duration={lDuration}
              boltCount={lBoltCount}
              segmentsPerEdge={lSegments}
              jitter={lJitter}
            />
          )}

          <div className='flex flex-row space-x-2 h-full relative'>
            {/* Rank + RR */}
            <div className='flex flex-1 space-x-2'>
              {data?.image ? (
                <img src={data.image} alt='rank' className='h-full' />
              ) : (
                <div className='h-full w-10 bg-gray-700/60 rounded' />
              )}
              <div className='flex flex-col font-semibold text-lg justify-between py-1'>
                <span className='text-lg font-semibold'>{data?.currentRR ?? 0} RR</span>
                <span className={`flex items-center text-lg font-bold ${color}`}>
                  <Icon className='w-5 h-5 mr-1' />
                  {Number.isFinite(rrNum) ? rrNum : 0}
                </span>
              </div>
            </div>

            {/* W / L */}
            <div className='flex items-center text-3xl font-semibold'>
              <span className='mr-1.5'>W/L:</span>
              {wavesEnabled ? (
                <>
                  <WaveNumber baseColor={textHex} value={data?.wins ?? 0} color='#10B981' variant={0} />
                  <span>-</span>
                  <WaveNumber baseColor={textHex} value={data?.losses ?? 0} color='#EF4444' variant={1} />
                </>
              ) : (
                <>
                  <span className='font-bold text-5xl' style={{ color: '#10B981' }}>
                    {data?.wins ?? 0}
                  </span>
                  <span>-</span>
                  <span className='font-bold text-5xl' style={{ color: '#EF4444' }}>
                    {data?.losses ?? 0}
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Tracker;

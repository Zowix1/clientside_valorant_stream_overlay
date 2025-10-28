import { useMemo, useState } from 'react';
import { FiEye, FiEyeOff, FiChevronUp, FiChevronDown, FiCopy, FiCheck, FiExternalLink } from 'react-icons/fi';
import Select from 'react-select';
import { computeSafePollMs } from '../hooks/useHenrikStats';

const REGION_OPTS = [
  { value: 'eu', label: 'Europe (EU)' },
  { value: 'na', label: 'North America (NA)' },
  { value: 'ap', label: 'Asia Pacific (AP)' },
  { value: 'kr', label: 'Korea (KR)' },
  { value: 'br', label: 'Brazil (BR)' },
  { value: 'latam', label: 'LATAM' },
];

const selectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgba(16, 24, 40, 0.7)', // gray-900/70
    borderColor: state.isFocused ? '#22d3ee' : '#1f2937', // cyan-400 / gray-800
    boxShadow: 'none',
    ':hover': { borderColor: '#22d3ee' },
    minHeight: 44,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#0b1220',
    color: '#e5e7eb',
    overflow: 'hidden',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#1f2937' : 'transparent', // gray-800 hover
    color: '#e5e7eb',
    ':active': { backgroundColor: '#374151' },
  }),
  singleValue: (base) => ({ ...base, color: '#e5e7eb' }),
  input: (base) => ({ ...base, color: '#e5e7eb' }),
  placeholder: (base) => ({ ...base, color: '#9ca3af' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? '#e5e7eb' : '#9ca3af',
    ':hover': { color: '#e5e7eb' },
  }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: '#1f2937' }),
};

// Small utility
const clampInt = (v, min = 1) => Math.max(min, parseInt(v || 0, 10));

export default function LandingCard({ settings }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [regionOpt, setRegionOpt] = useState(REGION_OPTS[0]);
  const [mode, setMode] = useState('puuid'); // 'puuid' | 'riot'
  const [puuid, setPuuid] = useState('');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [accounts, setAccounts] = useState(1);
  const [copied, setCopied] = useState(false);

  const pollMs = computeSafePollMs({ accounts });

  // --- serialize overlay customizations into URLSearchParams ---
  const appendSettings = (p) => {
    if (!settings) return;

    // Border
    const { border, card, waves, lightning, socials } = settings;
    if (border?.mode === 'solid') {
      p.set('border', 's');
      if (border.solid) p.set('bs', border.solid);
      if (typeof border.solidAlpha === 'number') {
        p.set('bsa', String(Math.max(0, Math.min(1, border.solidAlpha))));
      }
    } else {
      p.set('border', 'g');
      const stops =
        Array.isArray(border?.gradient) && border.gradient.length ? border.gradient : ['#6b21a8', '#ec4899'];
      if (stops[0]) p.set('b1', stops[0]);
      if (stops[1]) p.set('b2', stops[1]);
    }

    // Card colors
    if (card?.bg) p.set('bg', card.bg);
    if (typeof card?.bgAlpha === 'number') {
      p.set('bga', String(Math.max(0, Math.min(1, card.bgAlpha))));
    }
    if (card?.text) p.set('text', card.text);

    // Waves
    p.set('waves', waves?.enabled ? '1' : '0');

    // Lightning
    if (lightning) {
      p.set('light', lightning.enabled ? '1' : '0');
      if (lightning.enabled) {
        if (lightning.interval != null) p.set('lint', String(lightning.interval));
        if (lightning.boltCount != null) p.set('lbolts', String(lightning.boltCount));
        if (lightning.duration != null) p.set('ldur', String(lightning.duration));
        if (lightning.segmentsPerEdge != null) p.set('lseg', String(lightning.segmentsPerEdge));
        if (lightning.jitter != null) p.set('ljit', String(lightning.jitter));
      }
    }

    // Socials Banner
    if (socials) {
      p.set('sb', socials.enabled ? '1' : '0');
      if (socials.enabled) {
        if (socials.interval != null) p.set('sbint', String(socials.interval));
        const items = socials.items || {};
        Object.keys(items).forEach((k) => {
          const it = items[k];
          if (!it) return;
          p.set(`s_${k}_en`, it.enabled ? '1' : '0');
          if (it.handle) p.set(`s_${k}`, it.handle);
        });
      }
    }
  };

  const url = useMemo(() => {
    const base = `${window.location.origin}/overlay`;
    const p = new URLSearchParams();
    const region = regionOpt?.value;

    if (region) p.set('region', region);
    p.set('accounts', String(clampInt(accounts)));
    if (mode === 'puuid' && puuid) p.set('puuid', puuid);
    if (mode === 'riot' && name && tag) {
      p.set('name', name);
      p.set('tag', tag);
    }
    if (apiKey) p.set('key', apiKey);

    // customizations
    appendSettings(p);

    return `${base}?${p.toString()}`;
  }, [apiKey, regionOpt, mode, puuid, name, tag, accounts, JSON.stringify(settings)]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  // Fancy segmented control for radio
  const Segmented = () => (
    <div className='relative w-full sm:w-auto rounded-lg p-1 bg-gray-900/70 ring-1 ring-white/10'>
      <div className='grid grid-cols-2 gap-1'>
        {[
          { key: 'puuid', label: 'PUUID' },
          { key: 'riot', label: 'Riot ID' },
        ].map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type='button'
              onClick={() => setMode(opt.key)}
              className={
                'relative isolate h-10 px-3 cursor-pointer rounded-md text-sm font-medium transition ' +
                (active
                  ? 'bg-gradient-to-r from-[#e63f4d] via-[#00cee6] to-[#7d53dd] text-white shadow ring-1 ring-white/10'
                  : 'text-gray-300 hover:text-white hover:bg-white/5')
              }>
              <span className='px-3'>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const StepNumber = () => (
    <div className='relative'>
      <div
        className='
      relative rounded-md bg-gray-900/70
      ring-1 ring-white/10
      focus-within:ring-2 focus-within:ring-cyan-400/60
    '>
        <input
          type='number'
          min={1}
          value={accounts}
          onChange={(e) => setAccounts(clampInt(e.target.value))}
          className='w-full bg-transparent px-3 py-2.5 pr-12 font-medium text-white
                   outline-none appearance-none'
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAccounts((v) => clampInt(v + 1));
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAccounts((v) => clampInt(v - 1));
            }
          }}
        />

        <div className='absolute right-1 top-1 bottom-1 flex flex-col overflow-hidden rounded-md ring-1 ring-white/10'>
          <button
            type='button'
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAccounts((v) => clampInt(v + 1))}
            className='cursor-pointer flex-1 px-2 grid place-items-center bg-gray-800/80 hover:bg-gray-700/80 transition-colors
                     focus:outline-none'
            aria-label='Increase accounts'>
            <FiChevronUp className='h-4 w-4 text-gray-200' />
          </button>
          <button
            type='button'
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAccounts((v) => clampInt(v - 1))}
            className='cursor-pointer flex-1 px-2 grid place-items-center bg-gray-800/80 hover:bg-gray-700/80 transition-colors
                     focus:outline-none'
            aria-label='Decrease accounts'>
            <FiChevronDown className='h-4 w-4 text-gray-200' />
          </button>
        </div>
      </div>

      <p className='mt-1 text-xs text-gray-400'>
        Polling: <span className='font-mono'>{Math.round(pollMs / 1000)}s</span> (≈ 2 requests per poll × accounts)
      </p>
    </div>
  );

  return (
    <div
      className='
        w-full rounded-lg p-6 sm:p-7
        bg-gray-900/70 backdrop-blur-xs
        ring-1 ring-white/10
        shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]
        relative overflow-x-hidden overflow-y-auto sm:overflow-y-hidden
      '>
      {/* Top accent bar */}
      <div className='absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#FF4655] via-[#00E5FF] to-[#8B5CF6]' />

      {/* Header */}
      <div className='flex items-center justify-center mb-4'>
        <h1 className='text-xl sm:text-2xl font-bold tracking-tight'>Valorant Overlay Link Generator</h1>
      </div>

      {/* API Key */}
      <label className='flex flex-col space-y-1.5'>
        <span className='text-sm text-gray-300'>HenrikDEV API Key</span>
        <div className='relative'>
          <input
            type={showKey ? 'text' : 'password'}
            className='w-full rounded-md bg-gray-900/70 px-3 py-2.5 pr-10 text-white ring-1 ring-white/10
                       focus:outline-none focus:ring-2 focus:ring-cyan-400/60'
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder='Paste your key…'
            autoCorrect='off'
            autoComplete='off'
            spellCheck={false}
          />
          <button
            type='button'
            onClick={() => setShowKey((v) => !v)}
            className='absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-white'>
            {showKey ? <FiEyeOff className='h-5 w-5' /> : <FiEye className='h-5 w-5' />}
          </button>
        </div>
        <div className='flex items-center text-xs ml-2 text-gray-400'>
          <span>
            Don't have a key? Get it{' '}
            <a
              href='https://docs.henrikdev.xyz/authentication-and-authorization'
              target='_blank'
              className='cursor-pointer underline underline-offset-2 font-semibold text-[#00E5FF]'>
              here
            </a>
            .
          </span>
        </div>
      </label>

      {/* Region + Accounts */}
      <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <label className='flex flex-col space-y-1.5'>
          <span className='text-sm text-gray-300'>Region</span>
          <Select
            options={REGION_OPTS}
            value={regionOpt}
            onChange={setRegionOpt}
            styles={selectStyles}
            isSearchable
            placeholder='Select region…'
          />
        </label>

        <label className='flex flex-col space-y-1.5'>
          <span className='text-sm text-gray-300'>How many accounts (for this key)</span>
          <StepNumber />
        </label>
      </div>

      {/* Mode switch */}
      <div className='mt-4'>
        <span className='text-sm text-gray-300'>Account Identifier</span>
        <div className='mt-2 flex flex-wrap gap-3'>
          <Segmented />
        </div>
      </div>

      {/* PUUID or Riot ID */}
      {mode === 'puuid' ? (
        <label className='flex flex-col mt-4 space-y-1.5'>
          <span className='text-sm text-gray-300'>PUUID</span>
          <input
            className='w-full rounded-md bg-gray-900/70 px-3 py-2.5 text-white ring-1 ring-white/10
                       focus:outline-none focus:ring-2 focus:ring-cyan-400/60'
            value={puuid}
            onChange={(e) => setPuuid(e.target.value)}
            placeholder='ad7d05d1-…-…'
          />
        </label>
      ) : (
        <div className='mt-4 grid grid-cols-2 gap-4'>
          <label className='flex flex-col space-y-1.5'>
            <span className='text-sm text-gray-300'>Name</span>
            <input
              className='w-full rounded-md bg-gray-900/70 px-3 py-2.5 text-white ring-1 ring-white/10
                         focus:outline-none focus:ring-2 focus:ring-cyan-400/60'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Player'
            />
          </label>
          <label className='flex flex-col space-y-1.5'>
            <span className='text-sm text-gray-300'>Tag</span>
            <input
              className='w-full rounded-md bg-gray-900/70 px-3 py-2.5 text-white ring-1 ring-white/10
                         focus:outline-none focus:ring-2 focus:ring-cyan-400/60'
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder='420'
            />
          </label>
        </div>
      )}

      {/* URL + actions */}
      <div className='mt-6'>
        <div className='text-sm text-gray-300 mb-1.5'>Browser Source URL (keep private)</div>
        <div className='relative'>
          <input
            readOnly
            className='w-full rounded-md bg-gray-900/70 px-3 py-2.5 pr-[6.5rem] font-mono text-[12px] text-gray-100 ring-1 ring-white/10
                       focus:outline-none focus:ring-2 focus:ring-cyan-400/60'
            value={url}
            onFocus={(e) => {
              e.preventDefault();
              e.target.select();
            }}
          />
          <div className='absolute right-1 top-1 bottom-1 flex gap-1'>
            <button
              type='button'
              onClick={handleCopy}
              className='px-3 rounded-md bg-[#1b2534] hover:bg-[#2e3849] transition-colors cursor-pointer ring-1 ring-white/10 text-sm flex items-center gap-2'>
              {copied ? <FiCheck className='h-4 w-4 text-emerald-400' /> : <FiCopy className='h-4 w-4' />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={url}
              target='_blank'
              rel='noreferrer'
              className='relative isolate px-3 rounded-md bg-gradient-to-r from-[#e63f4d] via-[#00cee6] to-[#7d53dd]
                         hover:opacity-95 text-sm font-medium flex items-center gap-2 overflow-hidden group'>
              Open <FiExternalLink className='h-4 w-4' />
              <div className='absolute z-10 inset-0 group-hover:bg-white/20 transition-colors duration-300'></div>
            </a>
          </div>
        </div>

        <div className='mt-2 text-xs text-gray-400 flex items-center justify-between'>
          <span>
            ~2 requests per poll. With {clampInt(accounts)} account(s):{' '}
            <span className='font-mono'>{Math.round(pollMs / 1000)}s</span>.
          </span>
        </div>
        <div className='mt-2 text-xs text-gray-400 flex items-center'>
          <span>
            Dimensions: <span className='font-mono'>368×104</span> (tracker only) ·{' '}
            <span className='font-mono'>368×136</span> (with socials)
          </span>
        </div>
      </div>
    </div>
  );
}

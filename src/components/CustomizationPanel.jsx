import { FiX, FiSliders, FiLayers, FiDroplet, FiZap } from 'react-icons/fi';
import { TiWavesOutline } from 'react-icons/ti';
import { IoEarthOutline } from 'react-icons/io5';

function ColorRow({ label, value, onChange, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className='text-gray-300'>{label}</span>
      <div className='flex items-center gap-2'>
        <input
          type='color'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className='h-8 w-8 rounded cursor-pointer bg-transparent border border-white/10'
        />
        <input
          type='text'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className='w-28 rounded bg-gray-900/60 px-2 py-1 text-xs ring-1 ring-white/10 outline-none'
        />
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center justify-between ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className='text-gray-300'>{label}</span>
      <input
        type='checkbox'
        className='accent-cyan-400 h-4 w-4'
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberRow({ label, value, onChange, min, max, step = 1, suffix, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className='text-gray-300'>{label}</span>
      <div className='flex items-center gap-2'>
        <input
          type='number'
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className='w-24 rounded bg-gray-900/60 px-2 py-1 text-xs ring-1 ring-white/10 outline-none'
        />
        {suffix && <span className='text-gray-400 text-xs'>{suffix}</span>}
      </div>
    </label>
  );
}

export default function CustomizationPanel({ settings, onChange, onClose, onReset }) {
  const s = settings;

  // helpers to update nested state
  const set = (path, value) => {
    onChange((prev) => {
      const clone = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));
      let ref = clone;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
      ref[parts[parts.length - 1]] = value;
      // Socials auto-off if all items disabled
      if (path.startsWith('socials.items')) {
        const items = clone.socials.items;
        const allOff = Object.values(items).every((x) => !x.enabled);
        clone.socials.enabled = !allOff && clone.socials.enabled;
      }
      return clone;
    });
  };

  const toggleBanner = (checked) => {
    onChange((prev) => {
      const clone = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));
      clone.socials.enabled = checked;
      if (checked) {
        // Re-enable all with defaults if they were all off
        Object.keys(clone.socials.items).forEach((k) => {
          clone.socials.items[k].enabled = true;
          if (!clone.socials.items[k].handle) clone.socials.items[k].handle = 'yourname';
        });
      }
      return clone;
    });
  };

  const accentStyle =
    settings?.border?.mode === 'solid'
      ? { background: settings.border.solid }
      : {
          background: `linear-gradient(90deg, ${(settings?.border?.gradient
            ? [...settings?.border?.gradient, settings?.border?.gradient[0]]
            : ['#FF4655', '#00E5FF', '#FF4655']
          ).join(', ')})`,
        };

  return (
    <div className='w-full h-[calc(100vh-30px)] sm:h-full rounded-lg pt-1.5 bg-gray-900/70 backdrop-blur-xs ring-1 ring-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] relative overflow-hidden'>
      {/* Accent bar */}
      <div className='absolute inset-x-0 top-0 h-1.5' style={accentStyle} />
      {/* <div className='absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#FF4655] via-[#00E5FF] to-[#8B5CF6]' /> */}

      <div className='flex flex-col p-4 overflow-x-hidden overflow-y-auto h-full w-full'>
        {/* Header */}
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <FiSliders className='h-4 w-4 text-cyan-300' />
            <h2 className='text-sm font-semibold tracking-wide uppercase text-gray-200'>Customize</h2>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onReset}
              className='h-8 px-2 grid place-items-center cursor-pointer rounded-md bg-gray-900/70 ring-1 ring-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-xs'>
              Reset
            </button>
            <button
              type='button'
              onClick={onClose}
              className='h-8 w-8 grid place-items-center cursor-pointer rounded-md bg-gray-900/70 ring-1 ring-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors'>
              <FiX className='h-4 w-4' />
            </button>
          </div>
        </div>

        <div className='space-y-4 text-sm'>
          {/* Border */}
          <section className='rounded-md ring-1 ring-white/10 p-3 bg-gray-900/40'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <FiLayers className='h-4 w-4 text-violet-300' />
                <h3 className='font-medium text-gray-100'>Border</h3>
              </div>
              <div className='flex items-center gap-3'>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='borderMode'
                    checked={s.border.mode === 'gradient'}
                    onChange={() => set('border.mode', 'gradient')}
                    className='accent-cyan-400'
                  />
                  Gradient
                </label>
                <label className='flex items-center gap-1 text-xs'>
                  <input
                    type='radio'
                    name='borderMode'
                    checked={s.border.mode === 'solid'}
                    onChange={() => set('border.mode', 'solid')}
                    className='accent-cyan-400'
                  />
                  Solid
                </label>
              </div>
            </div>

            {s.border.mode === 'gradient' ? (
              <div className='mt-3 space-y-2'>
                {s.border.gradient.map((c, i) => (
                  <ColorRow
                    key={i}
                    label={`Stop ${i + 1}`}
                    value={c}
                    onChange={(v) => {
                      const arr = [...s.border.gradient];
                      arr[i] = v;
                      set('border.gradient', arr);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className='mt-3'>
                <ColorRow label='Solid' value={s.border.solid} onChange={(v) => set('border.solid', v)} />
              </div>
            )}
          </section>

          {/* Card Colors */}
          <section className='rounded-md ring-1 ring-white/10 p-3 bg-gray-900/40'>
            <div className='flex items-center gap-2 mb-2'>
              <FiDroplet className='h-4 w-4 text-cyan-300' />
              <h3 className='font-medium text-gray-100'>Card Colors</h3>
            </div>
            <div className='space-y-2'>
              <ColorRow label='BG' value={s.card.bg} onChange={(v) => set('card.bg', v)} />
              <ColorRow label='Text' value={s.card.text} onChange={(v) => set('card.text', v)} />
            </div>
          </section>

          {/* W/L Waves */}
          <section className='rounded-md ring-1 ring-white/10 p-3 bg-gray-900/40'>
            <div className='flex items-center gap-2 mb-2'>
              <TiWavesOutline className='h-4 w-4 text-indigo-300' />
              <h3 className='font-medium text-gray-100'>Win/Loss Numbers</h3>
            </div>
            <Toggle label='Wavy animation' checked={s.waves.enabled} onChange={(v) => set('waves.enabled', v)} />
          </section>

          {/* Lightning */}
          <section className='rounded-md ring-1 ring-white/10 p-3 bg-gray-900/40'>
            <div className='flex items-center gap-2 mb-2'>
              <FiZap className='h-4 w-4 text-emerald-300' />
              <h3 className='font-medium text-gray-100'>Lightning Border</h3>
            </div>
            <Toggle label='Enabled' checked={s.lightning.enabled} onChange={(v) => set('lightning.enabled', v)} />
            <div className='mt-3 space-y-2'>
              <NumberRow
                label='Interval'
                value={s.lightning.interval}
                onChange={(v) => set('lightning.interval', v)}
                min={1000}
                max={60000}
                step={250}
                suffix='ms'
                disabled={!s.lightning.enabled}
              />
              <NumberRow
                label='Bolt count'
                value={s.lightning.boltCount}
                onChange={(v) => set('lightning.boltCount', v)}
                min={0}
                max={6}
                step={1}
                disabled={!s.lightning.enabled}
              />
              <NumberRow
                label='Duration'
                value={s.lightning.duration}
                onChange={(v) => set('lightning.duration', v)}
                min={200}
                max={4000}
                step={50}
                suffix='ms'
                disabled={!s.lightning.enabled}
              />
              <NumberRow
                label='Segments/edge'
                value={s.lightning.segmentsPerEdge}
                onChange={(v) => set('lightning.segmentsPerEdge', v)}
                min={6}
                max={40}
                step={1}
                disabled={!s.lightning.enabled}
              />
              <NumberRow
                label='Jitter'
                value={s.lightning.jitter}
                onChange={(v) => set('lightning.jitter', v)}
                min={0}
                max={1}
                step={0.05}
                disabled={!s.lightning.enabled}
              />
            </div>
          </section>

          {/* Social Banner */}
          <section className='rounded-md ring-1 ring-white/10 p-3 bg-gray-900/40'>
            <div className='flex items-center gap-2 mb-2'>
              <IoEarthOutline className='h-4 w-4 text-[#5865F2]' />
              <h3 className='font-medium text-gray-100'>Social Banner</h3>
            </div>
            <Toggle label='Enabled' checked={s.socials.enabled} onChange={toggleBanner} />
            <div className={`mt-2 ${!s.socials.enabled ? 'opacity-50 pointer-events-none' : ''} space-y-2`}>
              {Object.entries(s.socials.items).map(([key, v]) => (
                <div key={key} className='flex items-center justify-between gap-2'>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      className='accent-cyan-400 h-4 w-4'
                      checked={v.enabled}
                      onChange={(e) => set(`socials.items.${key}.enabled`, e.target.checked)}
                    />
                    <span className='capitalize text-gray-300 text-xs truncate max-w-10'>{key}</span>
                  </label>
                  <input
                    type='text'
                    value={v.handle}
                    onChange={(e) => set(`socials.items.${key}.handle`, e.target.value)}
                    placeholder='handle'
                    className='w-36 rounded bg-gray-900/60 px-2 py-1 text-xs ring-1 ring-white/10 outline-none'
                  />
                </div>
              ))}
            </div>
            <p className='mt-2 text-[11px] text-gray-400'>
              If you turn every network off, the banner auto-disables. Turning it back on re-enables all with default
              handles.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

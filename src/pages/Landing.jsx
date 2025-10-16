import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import OGLParticlesBG from '../components/OGLParticlesBG';
import LandingCard from '../components/LandingCard';
import CustomizationPanel from '../components/CustomizationPanel';

const DEFAULT_SETTINGS = {
  border: {
    mode: 'gradient', // 'gradient' | 'solid'
    gradient: ['#6b21a8', '#ec4899'],
    solid: '#FF4655',
    solidAlpha: 1,
  },
  card: {
    bg: '#111827', // gray-900
    bgAlpha: 1,
    text: '#FFFFFF',
  },
  waves: { enabled: true }, // W/L wave animation
  lightning: {
    enabled: true,
    interval: 20000,
    boltCount: 6,
    duration: 1200,
    segmentsPerEdge: 12,
    jitter: 6,
  },
  socials: {
    enabled: false,
    items: {
      youtube: { enabled: true, handle: 'yourname' },
      discord: { enabled: true, handle: 'yourserver' },
      tiktok: { enabled: true, handle: 'yourname' },
      twitter: { enabled: true, handle: 'yourname' },
      kick: { enabled: true, handle: 'yourname' },
    },
  },
};

function Landing() {
  const [customOpen, setCustomOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Layout constants (must match panel)
  const PANEL_W = 280; // w-[280px]
  const PANEL_GAP = 12; // ml-3 (0.75rem)
  const SHIFT_X = -((PANEL_W + PANEL_GAP) / 2); // center card+panel

  // track breakpoint (sm: 640px)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const set = () => setIsDesktop(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

  const makeWeighted = (entries) => entries.flatMap(({ hex, n }) => Array.from({ length: n }, () => hex));

  return (
    <div className='page flex flex-col justify-center items-center bg-gray-950 text-white isolate overflow-hidden'>
      <OGLParticlesBG
        className=''
        palette={makeWeighted([
          { hex: '#FF4655', n: 5 },
          { hex: '#00E5FF', n: 3 },
          { hex: '#8B5CF6', n: 2 },
          { hex: '#E5E7EB', n: 2 },
        ])}
        particleCount={300}
        particleSpread={10}
        cameraDistance={20}
        depthAmplify={3.0}
        speed={0.1}
        parallax={{ strength: 1.1, lerp: 0.07 }}
        rotateSpeed={{ x: 0.01, y: 0.03, z: 0.015 }}
      />

      {/* Centered stage for card + side panel */}
      <div className='relative w-full max-w-4xl mx-auto px-4 overflow-x-hidden overflow-y-auto'>
        <div className='relative w-full flex justify-center'>
          <motion.div
            className='relative w-full p-6 sm:p-0 sm:w-fit'
            style={{ willChange: 'transform' }}
            animate={{ x: customOpen && isDesktop ? SHIFT_X : 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
            {/* Main card */}
            <LandingCard settings={settings} />

            <AnimatePresence>
              {!customOpen && isDesktop && (
                <motion.button
                  key='customize-tab'
                  type='button'
                  onClick={() => setCustomOpen(true)}
                  initial={{ opacity: 0, x: 8, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className='hidden sm:flex items-center gap-2 absolute top-6 -right-4
                             h-9 px-2 rounded-md bg-gray-900/80 ring-1 ring-white/10
                             hover:bg-white/10 text-gray-200 shadow-lg cursor-pointer transition-colors'
                  aria-label='Open customization'
                  aria-expanded='false'
                  aria-controls='customizer-desktop'>
                  {/* tiny connector notch */}
                  <span
                    className='pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 h-6 w-2
                               rounded-l-md bg-gray-900/80 ring-1 ring-white/10'
                  />
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-4 w-4'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'>
                    <path d='M4 21v-7a4 4 0 0 1 4-4h10' />
                    <path d='M14 3h7v7' />
                  </svg>
                  <span className='text-xs font-medium pr-1'>Customize</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Desktop panel: fixed width; slide/opacity only */}
            <AnimatePresence>
              {customOpen && isDesktop && (
                <motion.div
                  id='customizer-desktop'
                  key='customizer-desktop'
                  className='hidden sm:block absolute left-full top-0 ml-3 h-full w-[280px] z-20'
                  initial={{ opacity: 0, x: 14, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 14, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
                  <CustomizationPanel
                    settings={settings}
                    onChange={setSettings}
                    onClose={() => setCustomOpen(false)}
                    onReset={() => setSettings(DEFAULT_SETTINGS)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Mobile: FAB opens the sheet */}
      <AnimatePresence>
        {!customOpen && !isDesktop && (
          <motion.button
            key='mobile-fab'
            type='button'
            onClick={() => setCustomOpen(true)}
            className='sm:hidden fixed bottom-10 right-6 z-30 h-12 w-12 rounded-full
                       bg-gray-900/80 ring-1 ring-white/10 shadow-lg
                       grid place-items-center text-gray-200 hover:bg-white/10 cursor-pointer'
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            aria-label='Open customization'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'>
              <path d='M4 21v-7a4 4 0 0 1 4-4h10' />
              <path d='M14 3h7v7' />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile overlay sheet */}
      <AnimatePresence>
        {customOpen && !isDesktop && (
          <motion.div
            key='customizer-mobile'
            className='sm:hidden h-fit fixed inset-0 z-40 flex items-center justify-center p-4'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <div className='absolute inset-0 bg-black/60' onClick={() => setCustomOpen(false)} />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className='relative w-full max-w-sm h-full overflow-y-auto'>
              <CustomizationPanel
                settings={settings}
                onChange={setSettings}
                onClose={() => setCustomOpen(false)}
                onReset={() => setSettings(DEFAULT_SETTINGS)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className='fixed bottom-4 right-4 text-sm'>
        <span className='text-gray-800'>@zowix</span>
      </div>
    </div>
  );
}

export default Landing;

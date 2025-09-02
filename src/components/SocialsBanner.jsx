import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDiscord, FaTwitter } from 'react-icons/fa';
import { SiTiktok, SiKick, SiYoutube } from 'react-icons/si';

const PLATFORM = {
  discord: { Icon: FaDiscord, className: 'bg-[#5865F2] text-white' },
  tiktok: { Icon: SiTiktok, className: 'bg-gradient-to-r from-[#ff0050] via-black to-[#00f2ea] text-white' },
  twitter: { Icon: FaTwitter, className: 'bg-[#1DA1F2] text-black' },
  kick: { Icon: SiKick, className: 'bg-[#00e701] text-black' },
  youtube: { Icon: SiYoutube, className: 'bg-[#FF0000] text-white' },
};

function formatHandle(platform, raw) {
  if (!raw) return '';
  const t = raw.trim();
  if (platform === 'discord') {
    return t.startsWith('discord.gg') ? t : `discord.gg/${t.replace(/^@/, '')}`;
  }
  if (t.startsWith('@')) return t;
  return `@${t}`;
}

export default function SocialsBanner({
  interval = 3600, // ms
  items = {
    discord: { enabled: true, handle: 'discord.gg/yourserver' },
    tiktok: { enabled: true, handle: '@yourname' },
    twitter: { enabled: true, handle: '@yourname' },
    kick: { enabled: true, handle: '@yourname' },
    youtube: { enabled: true, handle: '@yourname' },
  },
}) {
  // Fixed rotation order for consistency
  const ordered = useMemo(
    () =>
      ['discord', 'tiktok', 'twitter', 'kick', 'youtube']
        .filter((k) => items?.[k]?.enabled)
        .map((k) => ({ key: k, ...items[k] })),
    [items]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ordered.length === 0) return;
    const iv = setInterval(() => setIndex((i) => (i + 1) % ordered.length), Math.max(800, interval));
    return () => clearInterval(iv);
  }, [ordered, interval]);

  if (ordered.length === 0) return null;

  const { key } = ordered[index];
  const { Icon, className } = PLATFORM[key];
  const handle = formatHandle(key, ordered[index].handle);

  return (
    <div className='w-full h-8 bg-gray-900 overflow-hidden relative'>
      <AnimatePresence mode='wait'>
        <motion.div
          key={`${key}-${handle}-${index}`}
          className={`absolute left-0 top-0 h-full w-full flex items-center justify-center gap-2 px-2 font-bold ${className}`}
          initial={{ x: '100%', opacity: 0, scaleX: 0.6, skewX: 0 }}
          animate={{ x: 0, opacity: 1, scaleX: 1, skewX: 0 }}
          exit={{ x: '-100%', opacity: 0, scaleX: 2.2, skewX: 30 }}
          transition={{
            x: { type: 'tween', duration: 0.6, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.3 },
            scaleX: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
            skewX: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
          }}>
          <Icon className='w-5 h-5' />
          <span>{handle}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

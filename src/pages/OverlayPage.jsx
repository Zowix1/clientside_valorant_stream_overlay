import { useSearchParams } from 'react-router-dom';
import AnimatedBorder from '../components/AnimatedBorder';
import Tracker from '../components/Tracker';
import SocialsBanner from '../components/SocialsBanner';

const clampInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const clamp01 = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
};

function hexToRgba(hex, a = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${a})`;
  let h = hex.trim();
  if (h.toLowerCase() === 'transparent') return 'transparent';
  if (h.startsWith('#')) h = h.slice(1);

  // #RGB
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  // #RRGGBBAA (prefer embedded alpha)
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const aa = parseInt(h.slice(6, 8), 16) / 255;
    return aa >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${aa})`;
  }
  // #RRGGBB
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  // Fallback
  return a >= 1 ? hex : `rgba(0,0,0,${a})`;
}

export default function OverlayPage() {
  const [params] = useSearchParams();

  // ---- AnimatedBorder (border) ----
  const borderMode = params.get('border') === 's' ? 'solid' : 'gradient'; // 'g' or 's'
  const borderGradient = [params.get('b1') || '#6b21a8', params.get('b2') || '#ec4899', params.get('b3') || '#6b21a8'];

  const borderSolidHex = params.get('bs') || '#6b21a8';
  const borderSolidAlpha = clamp01(params.get('bsa') ?? 1);
  const borderSolid = borderMode === 'solid' ? hexToRgba(borderSolidHex, borderSolidAlpha) : borderSolidHex; // value ignored when in gradient mode

  const borderWidth = clampInt(params.get('bw') ?? 4, 1, 24);
  const outerRadius = clampInt(params.get('br') ?? 12, 0, 48);
  const rotateDurationSec = Number(params.get('bdur') ?? 8);

  // ---- SocialsBanner ----
  const sbEnabled = params.get('sb') === '1';
  const sbInterval = clampInt(params.get('sbint') ?? 3600, 1000, 120000);

  const socialItem = (key, defEnabled, defHandle) => ({
    enabled: (params.get(`s_${key}_en`) ?? (defEnabled ? '1' : '0')) === '1',
    handle: params.get(`s_${key}`) ?? defHandle,
  });

  const socials = {
    youtube: socialItem('youtube', true, '@yourname'),
    discord: socialItem('discord', true, 'discord.gg/yourserver'),
    tiktok: socialItem('tiktok', true, '@yourname'),
    twitter: socialItem('twitter', true, '@yourname'),
    kick: socialItem('kick', true, '@yourname'),
  };

  // ---- Card background (with alpha) ----
  const bgParam = (params.get('bg') || '#111827').trim(); // legacy default
  const bgAlpha = clamp01(params.get('bga') ?? 1);
  const cardBg = bgParam.toLowerCase() === 'transparent' || bgAlpha === 0 ? 'transparent' : hexToRgba(bgParam, bgAlpha);

  return (
    <div className='h-full text-white bg-transparent'>
      <AnimatedBorder
        borderWidth={borderWidth}
        outerRadius={outerRadius}
        mode={borderMode}
        gradient={borderGradient}
        solid={borderSolid}
        rotateDurationSec={rotateDurationSec}>
        <div className='relative w-[360px]'>
          <Tracker />
          {sbEnabled && <SocialsBanner background={cardBg} interval={sbInterval} items={socials} />}
        </div>
      </AnimatedBorder>
    </div>
  );
}

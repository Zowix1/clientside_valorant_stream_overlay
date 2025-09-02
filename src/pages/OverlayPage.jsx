import { useSearchParams } from 'react-router-dom';
import AnimatedBorder from '../components/AnimatedBorder';
import Tracker from '../components/Tracker';
import SocialsBanner from '../components/SocialsBanner';

const clampInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

export default function OverlayPage() {
  const [params] = useSearchParams();

  // ---- AnimatedBorder (border) ----
  const borderMode = params.get('border') === 's' ? 'solid' : 'gradient'; // 'g' or 's'
  const borderGradient = [params.get('b1') || '#6b21a8', params.get('b2') || '#ec4899', params.get('b3') || '#6b21a8'];
  const borderSolid = params.get('bs') || '#6b21a8';
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

  return (
    <div className='h-full text-white bg-white'>
      <AnimatedBorder
        borderWidth={borderWidth}
        outerRadius={outerRadius}
        mode={borderMode}
        gradient={borderGradient}
        solid={borderSolid}
        rotateDurationSec={rotateDurationSec}
        innerBackground='transparent'>
        <div className='relative w-[360px]'>
          <Tracker />
          {sbEnabled && <SocialsBanner interval={sbInterval} items={socials} />}
        </div>
      </AnimatedBorder>
    </div>
  );
}

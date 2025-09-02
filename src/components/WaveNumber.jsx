import { useMemo } from 'react';
import { useSpring, animated, to } from 'react-spring';

function generateWavePath(amp1, phase1, wl1, amp2, phase2, wl2) {
  const start = -100,
    end = 200,
    midY = 60,
    bottomY = 110,
    step = 5;
  let d = `M ${start},${midY}`;
  for (let x = start; x <= end; x += step) {
    const pct1 = (((x % wl1) + wl1) % wl1) / wl1;
    const pct2 = (((x % wl2) + wl2) % wl2) / wl2;
    const y1 = amp1 * Math.sin(2 * Math.PI * pct1 + phase1);
    const y2 = amp2 * Math.sin(2 * Math.PI * pct2 + phase2);
    d += ` L ${x.toFixed(2)},${(midY + y1 + y2).toFixed(2)}`;
  }
  return d + ` L ${end},${bottomY} L ${start},${bottomY} Z`;
}

export default function WaveNumber({ baseColor = '#FFF', value, color = '#10B981', variant = 0 }) {
  // two seamless presets
  const { amp1, amp2, wl1, wl2, dur1, dur2 } = useMemo(
    () =>
      variant === 0
        ? { amp1: 10, amp2: 5, wl1: 300, wl2: 150, dur1: 9000, dur2: 5000 }
        : { amp1: 8, amp2: 4, wl1: 100, wl2: 75, dur1: 7000, dur2: 3000 },
    [variant]
  );

  const spring1 = useSpring({
    from: { p: 0 },
    to: { p: 2 * Math.PI },
    loop: true,
    config: { duration: dur1, easing: (t) => t },
  });
  const spring2 = useSpring({
    from: { p: 0 },
    to: { p: 2 * Math.PI },
    loop: true,
    config: { duration: dur2, easing: (t) => t },
  });

  const clipId = `wave-clip-${value}-${variant}-${Math.random().toString(36).slice(2)}`;

  return (
    <animated.svg
      viewBox='0 0 100 100'
      preserveAspectRatio='xMidYMid meet'
      style={{
        height: '1em',
        width: 'auto',
        display: 'inline-block',
        verticalAlign: 'baseline',
        overflow: 'visible',
      }}>
      <defs>
        <clipPath id={clipId} clipPathUnits='userSpaceOnUse'>
          <animated.path
            fill='#000'
            d={to([spring1.p, spring2.p], (p1, p2) => generateWavePath(amp1, p1, wl1, amp2, p2, wl2))}
          />
        </clipPath>
      </defs>

      <text
        x='50'
        y='100'
        textAnchor='middle'
        fontSize='144'
        fontWeight='bold'
        fill={baseColor}
        dominantBaseline='alphabetic'>
        {value}
      </text>

      <text
        x='50'
        y='100'
        textAnchor='middle'
        fontSize='144'
        fontWeight='bold'
        fill={color}
        clipPath={`url(#${clipId})`}
        dominantBaseline='alphabetic'>
        {value}
      </text>
    </animated.svg>
  );
}

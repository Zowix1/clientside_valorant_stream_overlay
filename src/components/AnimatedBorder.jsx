import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

export default function AnimatedBorder({
  children,
  borderWidth = 4,
  outerRadius = 12,
  // new:
  mode = 'gradient', // 'gradient' | 'solid'
  gradient = ['#6b21a8', '#ec4899'],
  solid = '#6b21a8',
  rotateDurationSec = 8,
  innerBackground = 'transparent', // was gray-800—now configurable
}) {
  const angle = useMotionValue(0);

  useEffect(() => {
    const controls = animate(angle, 360, {
      repeat: Infinity,
      ease: 'linear',
      duration: Math.max(0.5, rotateDurationSec),
    });
    return () => controls.stop();
  }, [angle, rotateDurationSec]);

  const colors = mode === 'gradient' ? [...gradient, gradient[0]] : [solid, solid, solid];
  const gradientCss = useTransform(angle, (a) => `conic-gradient(from ${a}deg at 50% 50%, ${colors.join(',')})`);

  const outerStyle = {
    background: gradientCss,
    padding: borderWidth,
    borderRadius: outerRadius,
    display: 'inline-block',
  };

  const innerRadius = Math.max(0, outerRadius - borderWidth);
  const innerStyle = {
    borderRadius: innerRadius,
    overflow: 'hidden',
    backgroundColor: innerBackground,
  };

  return (
    <motion.div style={outerStyle} className='w-fit'>
      <div style={innerStyle}>{children}</div>
    </motion.div>
  );
}

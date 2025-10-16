import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

function hasMaskSupport() {
  if (typeof CSS !== 'undefined' && CSS.supports) {
    // Chrome/Safari need -webkit-mask-composite, Firefox supports mask-composite
    return CSS.supports('-webkit-mask-composite', 'xor') || CSS.supports('mask-composite', 'exclude');
  }
  // Assume supported in modern Chromium; OBS/CEF varies, but we’ll try both syntaxes below
  return true;
}

export default function AnimatedBorder({
  children,
  borderWidth = 4,
  outerRadius = 12,
  mode = 'gradient', // 'gradient' | 'solid'
  gradient = ['#6b21a8', '#ec4899'],
  solid = '#6b21a8',
  rotateDurationSec = 8,
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
  const conic = useTransform(angle, (a) => `conic-gradient(from ${a}deg at 50% 50%, ${colors.join(',')})`);

  const wrapperStyle = {
    position: 'relative',
    display: 'inline-block',
    padding: borderWidth,
    borderRadius: outerRadius,
  };

  const innerRadius = Math.max(0, outerRadius - borderWidth);

  // If mask is missing, we fall back to a plain border
  const fallbackBorder = !hasMaskSupport();

  const borderLayerStyle = fallbackBorder
    ? {
        position: 'absolute',
        inset: 0,
        borderRadius: outerRadius,
        pointerEvents: 'none',
        zIndex: 0,
        // Fallback border
        border: `${borderWidth}px solid`,
        borderColor: mode === 'solid' ? solid : gradient[0],
      }
    : {
        position: 'absolute',
        inset: 0,
        borderRadius: outerRadius,
        pointerEvents: 'none',
        zIndex: 0,
        background: conic,
        boxSizing: 'border-box',
        padding: borderWidth,
        // Standard syntax (Firefox):
        mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        maskComposite: 'exclude',
        maskRepeat: 'no-repeat, no-repeat',
        // WebKit syntax (Chrome/Safari/CEF):
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        WebkitMaskRepeat: 'no-repeat, no-repeat',
      };

  const contentStyle = {
    position: 'relative',
    zIndex: 1,
    borderRadius: innerRadius,
    overflow: 'hidden',
  };

  return (
    <div style={wrapperStyle}>
      <motion.div style={borderLayerStyle} />
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

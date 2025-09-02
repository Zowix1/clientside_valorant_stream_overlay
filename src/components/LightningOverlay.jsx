import { useRef, useEffect } from 'react';

export default function LightningOverlay({
  status,
  interval = 20000, // ms between strikes
  duration = 1000, // ms to draw + erase
  boltCount = 6,
  segmentsPerEdge = 12,
  jitter = 6,
}) {
  const canvasRef = useRef();
  const streamsRef = useRef([]);
  const rafRef = useRef();
  const intervalRef = useRef();

  // Calculate anchor corners
  function getCorners(w, h, extend = 0.3) {
    return [
      { x: 0, y: h * (1 + extend) }, // under BL
      { x: 0, y: 0 }, // TL
      { x: w, y: 0 }, // TR
      { x: w, y: h * (1 + extend) }, // under BR
    ];
  }

  // Build jagged points along edges
  function makeBoltPoints(w, h) {
    const corners = getCorners(w, h, 0.3);
    const pts = [];
    for (let i = 0; i < corners.length - 1; i++) {
      const P = corners[i],
        Q = corners[i + 1];
      const dx = Q.x - P.x,
        dy = Q.y - P.y;
      const len = Math.hypot(dx, dy);
      const px = -dy / len,
        py = dx / len;
      for (let s = 0; s <= segmentsPerEdge; s++) {
        const t = s / segmentsPerEdge;
        let x = P.x + dx * t,
          y = P.y + dy * t;
        if (s > 0 && s < segmentsPerEdge) {
          const off = (Math.random() - 0.5) * jitter * 2;
          x += px * off;
          y += py * off;
        }
        pts.push({ x, y });
      }
    }
    return pts;
  }

  // Kick off a new strike
  function strike() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // cancel prior RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const { width, height } = canvas.getBoundingClientRect();
    const now = Date.now();
    streamsRef.current = Array.from({ length: boltCount }).map(() => ({
      points: makeBoltPoints(width, height),
      start: now,
    }));
    runFrame();
  }

  // Frame loop: draw or erase based on Date.now()
  function runFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    const now = Date.now();
    ctx.clearRect(0, 0, width, height);
    const color = status === 'winning' ? '#10B981' : status === 'losing' ? '#EF4444' : '#FFFFFF08';

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    streamsRef.current = streamsRef.current.filter((stream) => {
      const elapsed = now - stream.start;
      if (elapsed < 0) return true;
      if (elapsed > 2 * duration) return false;

      const pts = stream.points;
      const total = pts.length;
      ctx.beginPath();

      if (elapsed <= duration) {
        // draw phase
        const frac = elapsed / duration;
        const count = Math.floor(frac * (total - 1));
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= count; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      } else {
        // erase phase
        const frac = (elapsed - duration) / duration;
        const startIdx = Math.floor(frac * (total - 1));
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
        for (let i = startIdx + 1; i < total; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      return true;
    });

    if (streamsRef.current.length) {
      rafRef.current = requestAnimationFrame(runFrame);
    } else {
      rafRef.current = null;
    }
  }

  useEffect(() => {
    // initial strike and interval
    strike();
    intervalRef.current = setInterval(strike, interval);

    return () => {
      clearInterval(intervalRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, interval, duration, boltCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

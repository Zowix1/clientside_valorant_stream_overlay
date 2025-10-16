import { useRef, useEffect } from 'react';

export default function LightningOverlay({
  status,
  interval = 20000, // ms between strikes
  duration = 1000, // ms to draw + erase
  boltCount = 4,
  segmentsPerEdge = 10,
  jitter = 6,
  paused = false,
}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef(null);
  const strikeTimerRef = useRef(null);
  const streamsRef = useRef([]); // [{ points: {x,y}[], start: ts }]
  const readyRef = useRef(false);

  // ---------- sizing (no per-frame layout) ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctxRef.current = ctx;

    const maybeStart = () => {
      if (
        !paused &&
        readyRef.current &&
        !rafRef.current &&
        !strikeTimerRef.current &&
        streamsRef.current.length === 0
      ) {
        startStrike();
      }
    };

    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const changed = r.width !== sizeRef.current.w || r.height !== sizeRef.current.h || dpr !== sizeRef.current.dpr;

      if (changed) {
        sizeRef.current = { w: r.width, h: r.height, dpr };
        canvas.width = Math.max(1, Math.floor(r.width * dpr));
        canvas.height = Math.max(1, Math.floor(r.height * dpr));
        canvas.style.width = `${Math.floor(r.width)}px`;
        canvas.style.height = `${Math.floor(r.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
        if (r.width > 0 && r.height > 0) {
          readyRef.current = true;
          maybeStart();
        }
      }
    });
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // ---------- geometry ----------
  function getCorners(w, h, extend = 0.3) {
    return [
      { x: 0, y: h * (1 + extend) }, // under BL
      { x: 0, y: 0 }, // TL
      { x: w, y: 0 }, // TR
      { x: w, y: h * (1 + extend) }, // under BR
    ];
  }

  function makeBoltPoints(w, h) {
    const corners = getCorners(w, h, 0.3);
    const pts = [];
    for (let i = 0; i < corners.length - 1; i++) {
      const P = corners[i],
        Q = corners[i + 1];
      const dx = Q.x - P.x,
        dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
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

  // ---------- draw (progressive polyline like your original) ----------
  function drawFrame() {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (!ctx || !w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Use your “working” visibility tuning
    const base = status === 'winning' ? '#10B981' : status === 'losing' ? '#EF4444' : '#FFFFFF08';
    ctx.strokeStyle = base;
    ctx.globalAlpha = status === 'even' ? 0.25 : 0.9; // visible even when even
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = base;
    ctx.shadowBlur = status === 'even' ? 4 : 8;

    const now = Date.now();
    const active = [];

    for (let i = 0; i < streamsRef.current.length; i++) {
      const stream = streamsRef.current[i];
      const elapsed = now - stream.start;
      if (elapsed < 0) {
        active.push(stream);
        continue;
      }
      if (elapsed > 2 * duration) {
        continue;
      }

      const pts = stream.points;
      const total = pts.length;
      if (total < 2) {
        active.push(stream);
        continue;
      }

      ctx.beginPath();

      if (elapsed <= duration) {
        // DRAW PHASE: grow from start → i = 0..count
        const frac = elapsed / duration;
        const count = Math.max(1, Math.floor(frac * (total - 1)));
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k <= count; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
      } else {
        // ERASE PHASE: anchor at END, shrink head forward (your original)
        const frac = (elapsed - duration) / duration; // 0..1
        const startIdx = Math.min(total - 2, Math.floor(frac * (total - 1)));
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
        for (let k = startIdx + 1; k < total; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
      }

      ctx.stroke();
      active.push(stream);
    }

    streamsRef.current = active;

    if (active.length) {
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      rafRef.current = null;
      ctx.globalAlpha = 1;
    }
  }

  // ---------- scheduler (no overlap; no per-frame resize) ----------
  function startStrike() {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    const now = Date.now();
    streamsRef.current = Array.from({ length: boltCount }, () => ({
      points: makeBoltPoints(w, h),
      start: now,
    }));

    if (!rafRef.current) rafRef.current = requestAnimationFrame(drawFrame);

    // schedule next strike after current completes (+ jitter)
    const restJitter = Math.round((Math.random() - 0.5) * 0.2 * interval); // ±10%
    const nextIn = Math.max(200, interval + restJitter);
    strikeTimerRef.current = setTimeout(() => {
      if (!paused) startStrike();
    }, 2 * duration + nextIn);
  }

  useEffect(() => {
    if (!paused && readyRef.current) startStrike();

    return () => {
      if (strikeTimerRef.current) {
        clearTimeout(strikeTimerRef.current);
        strikeTimerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, interval, duration, boltCount, segmentsPerEdge, jitter, paused]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5, // above card contents
        display: paused ? 'none' : 'block',
      }}
    />
  );
}

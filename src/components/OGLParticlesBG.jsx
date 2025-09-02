import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl';

const DEFAULT_PALETTE = ['#00e5ff', '#8b5cf6', '#7c3aed', '#00e5ff', '#8b5cf6', '#ff4655'];

const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3)
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  const int = parseInt(hex, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
};

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uDepthAmplify;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec3 vColor;

  void main() {
    vec3 pos = position * uSpread;
    pos.z *= uDepthAmplify;

    float t = uTime;
    pos.x += sin(t * 0.45 + random.x * 6.2831) * mix(0.05, 0.6, random.y);
    pos.y += sin(t * 0.38 + random.y * 6.2831) * mix(0.05, 0.6, random.z);
    pos.z += sin(t * 0.52 + random.z * 6.2831) * mix(0.05, 0.6, random.w);

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    vec4 mvPos = viewMatrix * mPos;

    float base = uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5));
    float dist = length(mvPos.xyz);
    gl_PointSize = base / dist;

    vColor = color;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.35, d);
    float glow  = smoothstep(0.35, 0.0, d);
    vec3 col = vColor * (0.85 + 0.15 * glow);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function OGLParticlesBG({
  className = '',
  palette = DEFAULT_PALETTE,

  // Scene feel
  particleCount = 160,
  particleSpread = 12,
  depthAmplify = 10.0,
  baseSize = 140,
  sizeRandomness = 0.6,

  // Motion
  speed = 0.18,
  rotateSpeed = { x: 0.03, y: 0.08, z: 0.04 },
  parallax = { strength: 1.1, lerp: 0.07 },

  // Camera
  cameraDistance = 28,
  cloudZOffset = 14,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ depth: false, alpha: true, antialias: true });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);
    gl.clearColor(0, 0, 0, 0);

    const camera = new Camera(gl, { fov: 16, near: 0.1, far: 500 });
    camera.position.set(0, 0, cameraDistance);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    };
    window.addEventListener('resize', resize);
    resize();

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const onMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;
      target.x = nx;
      target.y = -ny;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    // Geometry
    const count = particleCount;
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      let x, y, z, len;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      const r = Math.cbrt(Math.random());
      positions.set([x * r, y * r, z * r], i * 3);

      randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);

      const rgb = hexToRgb(palette[Math.floor(Math.random() * palette.length)]);
      colors.set(rgb, i * 3);
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: positions },
      random: { size: 4, data: randoms },
      color: { size: 3, data: colors },
    });

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: particleSpread },
        uDepthAmplify: { value: depthAmplify },
        uBaseSize: { value: baseSize },
        uSizeRandomness: { value: sizeRandomness },
      },
      transparent: true,
      depthTest: false,
    });

    const points = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    points.position.z = -cloudZOffset;

    // Animation
    let raf;
    let last = performance.now();
    let elapsed = 0;
    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const dt = (t - last) / 1000;
      last = t;

      elapsed += dt * speed;
      program.uniforms.uTime.value = elapsed * 2.0;

      current.x = lerp(current.x, target.x, parallax.lerp);
      current.y = lerp(current.y, target.y, parallax.lerp);
      camera.position.x = current.x * parallax.strength;
      camera.position.y = current.y * parallax.strength;

      points.rotation.x += rotateSpeed.x * dt;
      points.rotation.y += rotateSpeed.y * dt;
      points.rotation.z += rotateSpeed.z * dt;

      renderer.render({ scene: points, camera });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
    };
  }, [
    particleCount,
    particleSpread,
    depthAmplify,
    baseSize,
    sizeRandomness,
    speed,
    rotateSpeed.x,
    rotateSpeed.y,
    rotateSpeed.z,
    parallax.strength,
    parallax.lerp,
    cameraDistance,
    cloudZOffset,
    JSON.stringify(palette),
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 -z-10 pointer-events-none ${className}`}
      style={{
        overflow: 'hidden',
        overflowClipMargin: 0,
        contain: 'layout paint size',
      }}
    />
  );
}

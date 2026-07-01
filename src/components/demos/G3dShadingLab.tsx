import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated shading lab: a per-pixel shaded SPHERE lit by a moving light.
   - For every pixel inside the sphere's disk we reconstruct the 3D normal
       N = (x, y, sqrt(1 - x^2 - y^2))
     then apply Lambert diffuse (max(0, N·L)) + Blinn-Phong specular
     (max(0, N·H)^shininess) from a light direction L.
   - DRAG anywhere to move the light; the bright spot follows N·L, and the
     shiny highlight follows the half-vector H = normalize(L + V).
   - Sliders: shininess (highlight tightness) and specular strength k_s.
   - Toggle diffuse-only vs diffuse + specular.
   - Transport: Play orbits the light; Step / Back nudge it; Reset restores.
   ------------------------------------------------------------------ */

type Vec3 = [number, number, number];
type Light = { x: number; y: number }; // normalized disk coords, y up

const COLORS = { light: '#0ea5e9', hot: '#10b981', accent: '#4f46e5' };
const LIGHT_Z = 0.7; // forward bias so the light stays in front of the sphere
const INIT: Light = { x: 0.55, y: 0.5 };

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

export default function G3dShadingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [light, setLight] = useState<Light>({ ...INIT });
  const [shininess, setShininess] = useState(32);
  const [ks, setKs] = useState(0.6);
  const [specOn, setSpecOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const sizeRef = useRef({ w: 460, h: 340, cx: 230, cy: 170, rad: 130 });
  const dragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const lightRef = useRef(light);
  lightRef.current = light;

  // ---- rotate the light around the sphere centre by delta radians ----
  const orbit = (l: Light, delta: number): Light => {
    const r = Math.hypot(l.x, l.y) || 0.6;
    const a = Math.atan2(l.y, l.x) + delta;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, rad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // backing disk (so the unlit hemisphere still reads as a sphere)
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,30,46,0.9)';
    ctx.fill();

    const L = normalize([light.x, light.y, LIGHT_Z]);
    const V: Vec3 = [0, 0, 1]; // viewer looks straight down -z toward the sphere
    const H = normalize([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);

    const step = 4; // sample every 4px for speed
    let bestSpec = 0;
    let hotX = 0;
    let hotY = 0;

    for (let py = cy - rad; py < cy + rad; py += step) {
      for (let px = cx - rad; px < cx + rad; px += step) {
        const nx = (px - cx) / rad;
        const ny = -(py - cy) / rad; // flip so +y is up
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const N: Vec3 = [nx, ny, nz];

        const ndotl = Math.max(0, dot(N, L));
        const ambient = 0.08;
        const intensity = ambient + 0.92 * ndotl; // Lambert diffuse

        // warm base colour scaled by diffuse intensity
        let r = 236 * intensity;
        let g = 198 * intensity;
        let b = 150 * intensity;

        if (specOn && ndotl > 0) {
          const spec = ks * Math.pow(Math.max(0, dot(N, H)), shininess);
          r += 255 * spec;
          g += 255 * spec;
          b += 255 * spec;
          if (spec > bestSpec) {
            bestSpec = spec;
            hotX = px;
            hotY = py;
          }
        }

        ctx.fillStyle = `rgb(${Math.min(255, r) | 0},${Math.min(255, g) | 0},${Math.min(255, b) | 0})`;
        ctx.fillRect(px, py, step, step);
      }
    }

    // ring the specular hotspot
    if (specOn && bestSpec > 0.15) {
      ctx.beginPath();
      ctx.arc(hotX, hotY, 11, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.hot;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // the light itself, as a little sun dot on its screen position
    const lx = cx + light.x * rad;
    const ly = cy - light.y * rad;
    ctx.beginPath();
    ctx.arc(lx, ly, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.light;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // rays
    ctx.strokeStyle = COLORS.light;
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(lx + Math.cos(a) * 10, ly + Math.sin(a) * 10);
      ctx.lineTo(lx + Math.cos(a) * 14, ly + Math.sin(a) * 14);
      ctx.stroke();
    }

    // sphere outline
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rad = Math.min(w, h) * 0.4;
      sizeRef.current = { w, h, cx: w / 2, cy: h / 2, rad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any visual state change
  useEffect(draw, [light, shininess, ks, specOn]);

  // ---- continuous orbit via requestAnimationFrame ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      setLight(orbit(lightRef.current, dt * 0.9 * speed));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  // ---- pointer drag to place the light ----
  const place = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy, rad } = sizeRef.current;
    let nx = (e.clientX - rect.left - cx) / rad;
    let ny = -(e.clientY - rect.top - cy) / rad;
    const m = Math.hypot(nx, ny);
    const cap = 1.3;
    if (m > cap) { nx = (nx / m) * cap; ny = (ny / m) * cap; }
    setLight({ x: nx, y: ny });
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    setPlaying(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    place(e);
  };
  const onMove = (e: PointerEvent) => { if (dragRef.current) place(e); };
  const onUp = () => { dragRef.current = false; };

  // ---- transport ----
  const play = () => { lastRef.current = 0; setPlaying((p) => !p); };
  const stepF = () => { setPlaying(false); setLight((l) => orbit(l, 0.25)); };
  const stepB = () => { setPlaying(false); setLight((l) => orbit(l, -0.25)); };
  const reset = () => { setPlaying(false); setLight({ ...INIT }); };

  const angle = ((Math.atan2(light.y, light.x) * 180) / Math.PI + 360) % 360;
  const caption = specOn
    ? `Light at ${angle.toFixed(0)}° — brightest where N·L → 1 (facing the light); the ringed hotspot is where N·H^${shininess} peaks.`
    : `Light at ${angle.toFixed(0)}° — diffuse only: brightness = max(0, N·L), so it fades smoothly to the terminator where N·L = 0.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag anywhere to move the <span style={`color:${COLORS.light}`}>light</span>. Watch the bright spot and the <span style={`color:${COLORS.hot}`}>ringed</span> specular highlight chase it.</p>

          <label class="block">
            <span class="mb-1 block text-muted">shininess (exponent) = {shininess}</span>
            <input
              type="range" min={1} max={128} step={1} value={shininess}
              onInput={(e) => setShininess(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">specular strength k_s = {ks.toFixed(2)}</span>
            <input
              type="range" min={0} max={1} step={0.05} value={ks}
              onInput={(e) => setKs(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <label class="flex items-center gap-2">
            <input type="checkbox" checked={specOn} onChange={(e) => setSpecOn((e.target as HTMLInputElement).checked)} class="accent-[#10b981]" />
            <span class="text-muted">add Blinn-Phong specular</span>
          </label>

          <div class="flex flex-wrap items-center gap-2">
            <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
            <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
            <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
          </div>
          <label class="flex items-center gap-2 text-xs text-muted">speed
            <input type="range" min={0.3} max={3} step={0.1} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-28 accent-[#4f46e5]" />
          </label>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
    </div>
  );
}

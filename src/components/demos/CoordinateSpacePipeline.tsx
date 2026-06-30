import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Coordinate-space pipeline: follow one object through
   LOCAL -> WORLD -> VIEW -> SCREEN.
   - A little ship orbits in world space (animated).
   - Pick a stage to see the object drawn in that space, with the
     transform that got it there and the tracked nose coordinate.
   Canvas conventions from VectorPlayground.
   ------------------------------------------------------------------ */

type Stage = 'local' | 'world' | 'view' | 'screen';
const STAGES: Stage[] = ['local', 'world', 'view', 'screen'];

const COLORS = { ship: '#4f46e5', cam: '#0ea5e9', accent: '#10b981', grid: 'rgba(128,128,128,0.18)', axis: 'rgba(128,128,128,0.5)' };

// ship outline in LOCAL/model space (units)
const MODEL: [number, number][] = [[0.9, 0], [-0.6, 0.6], [-0.3, 0], [-0.6, -0.6]];
const NOSE: [number, number] = [0.9, 0];

export default function CoordinateSpacePipeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<Stage>('world');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 28, ox: 240, oy: 180 });

  // animation
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => { setT((v) => v + (now - last) / 1000); last = now; rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  // world transform of the ship: orbit + face along orbit
  const worldOf = (mx: number, my: number) => {
    const orbitR = 4, ang = t * 0.6;
    const cx = orbitR * Math.cos(ang), cy = orbitR * Math.sin(ang);
    const heading = ang + Math.PI / 2;
    const c = Math.cos(heading), s = Math.sin(heading);
    return { x: cx + (mx * c - my * s), y: cy + (mx * s + my * c) };
  };
  // camera sits a bit off-center and pans slowly
  const cam = { x: 1.5 * Math.cos(t * 0.25), y: 1.0 * Math.sin(t * 0.25) };
  const viewOf = (wx: number, wy: number) => ({ x: wx - cam.x, y: wy - cam.y });

  const toPx = (x: number, y: number) => { const { scale, ox, oy } = sizeRef.current; return { x: ox + x * scale, y: oy - y * scale }; };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const toStage = (mx: number, my: number) => {
      if (stage === 'local') return { x: mx, y: my };
      const wd = worldOf(mx, my);
      if (stage === 'world') return wd;
      const vd = viewOf(wd.x, wd.y);
      if (stage === 'view') return vd;
      // screen: flip y handled by toPx already; just scale view coords a touch
      return vd;
    };

    // camera marker in world/view space
    if (stage === 'world') { const cp = toPx(cam.x, cam.y); cameraIcon(ctx, cp, COLORS.cam); labelTxt(ctx, cp, 'camera', COLORS.cam); }
    if (stage === 'view' || stage === 'screen') { const cp = toPx(0, 0); cameraIcon(ctx, cp, COLORS.cam); labelTxt(ctx, cp, 'camera = origin', COLORS.cam); }

    // screen-space frame box
    if (stage === 'screen') {
      ctx.strokeStyle = COLORS.accent; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, w - 16, h - 16); ctx.setLineDash([]);
      ctx.fillStyle = COLORS.accent; ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText('viewport (pixels)', 14, 24);
    }

    const pts = MODEL.map(([mx, my]) => { const p = toStage(mx, my); return toPx(p.x, p.y); });
    polygon(ctx, pts, COLORS.ship, 'rgba(79,70,229,0.2)', 2.5);

    const noseS = toStage(NOSE[0], NOSE[1]); const noseP = toPx(noseS.x, noseS.y);
    ctx.fillStyle = COLORS.accent; ctx.beginPath(); ctx.arc(noseP.x, noseP.y, 5, 0, Math.PI * 2); ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(18, Math.min(32, w / 16));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [stage, t]);

  // tracked nose coordinate at each space
  const wNose = worldOf(NOSE[0], NOSE[1]);
  const vNose = viewOf(wNose.x, wNose.y);
  const { w, h, scale, ox, oy } = sizeRef.current;
  const sNose = { x: Math.round(ox + vNose.x * scale), y: Math.round(oy - vNose.y * scale) };
  const coord =
    stage === 'local' ? `(${NOSE[0].toFixed(2)}, ${NOSE[1].toFixed(2)})` :
    stage === 'world' ? `(${wNose.x.toFixed(2)}, ${wNose.y.toFixed(2)})` :
    stage === 'view' ? `(${vNose.x.toFixed(2)}, ${vNose.y.toFixed(2)})` :
    `(${sNose.x} px, ${sNose.y} px)`;
  const desc: Record<Stage, string> = {
    local: 'The ship’s own coordinates, fixed around its center. The nose is always (0.9, 0) here.',
    world: 'The model matrix places & rotates the ship in the shared world. The camera (sky) lives here too.',
    view: 'The view matrix re-expresses everything relative to the camera — the camera becomes the origin.',
    screen: 'Projection + viewport map view coords to pixel positions inside the viewport rectangle.',
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {STAGES.map((sname) => (
          <button key={sname} onClick={() => setStage(sname)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${stage === sname ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{sname}</button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">{playing ? '⏸' : '▶'}</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="flex items-center gap-2 text-xs">
            {STAGES.map((sname, i) => (
              <span key={sname} class="flex items-center gap-2">
                <span class={`rounded px-2 py-0.5 font-semibold capitalize ${stage === sname ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}>{sname}</span>
                {i < STAGES.length - 1 && <span class="text-muted">→</span>}
              </span>
            ))}
          </div>
          <Readout label={`nose in ${stage} space`} color={COLORS.accent} value={coord} />
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">{desc[stage]}</p>
          <p class="text-xs text-muted">Same green nose vertex, four different coordinate systems — each stage is one matrix multiply away from the next.</p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
function polygon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], stroke: string, fill: string, width: number) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
}
function cameraIcon(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.fillStyle = color; ctx.fillRect(at.x - 7, at.y - 5, 11, 10);
  ctx.beginPath(); ctx.moveTo(at.x + 4, at.y); ctx.lineTo(at.x + 11, at.y - 5); ctx.lineTo(at.x + 11, at.y + 5); ctx.closePath(); ctx.fill();
}
function labelTxt(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, text: string, color: string) {
  ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 12, at.y - 8);
}

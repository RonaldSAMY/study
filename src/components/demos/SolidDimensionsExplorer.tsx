import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Area & Volume of 3D solids.
   - Toggle between a rectangular box and a cylinder.
   - Sliders set the dimensions; the figure, surface area and volume
     all update live (volume grows much faster than the figure looks!).
   ------------------------------------------------------------------ */

type Solid = 'box' | 'cylinder';

const COLORS = {
  edge: '#4f46e5',
  face: 'rgba(79,70,229,0.14)',
  faceTop: 'rgba(14,165,233,0.20)',
  faceSide: 'rgba(16,185,129,0.18)',
};

export default function SolidDimensionsExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [solid, setSolid] = useState<Solid>('box');
  const [l, setL] = useState(3);
  const [wd, setWd] = useState(2);
  const [hgt, setHgt] = useState(2.5);
  const [rad, setRad] = useState(1.5);
  const sizeRef = useRef({ w: 480, h: 360 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(36, (Math.min(w, h)) / 9);
    const cx = w / 2;
    const cy = h / 2;

    if (solid === 'box') {
      const W = l * s, H = hgt * s, D = wd * s;
      const dx = D * 0.45, dy = -D * 0.45;
      // front-bottom-left origin so figure is centered
      const x = cx - (W + dx) / 2;
      const y = cy + (H - dy) / 2;
      const fbl = { x, y };
      const fbr = { x: x + W, y };
      const ftl = { x, y: y - H };
      const ftr = { x: x + W, y: y - H };
      const btr = { x: ftr.x + dx, y: ftr.y + dy };
      const btl = { x: ftl.x + dx, y: ftl.y + dy };
      const bbr = { x: fbr.x + dx, y: fbr.y + dy };
      // top
      poly(ctx, [ftl, ftr, btr, btl], COLORS.faceTop);
      // side
      poly(ctx, [ftr, fbr, bbr, btr], COLORS.faceSide);
      // front
      poly(ctx, [ftl, ftr, fbr, fbl], COLORS.face);
      // dimension labels
      lbl(ctx, (ftl.x + ftr.x) / 2, fbl.y + 16, `length ${l.toFixed(1)}`, '#0ea5e9');
      lbl(ctx, fbl.x - 14, (ftl.y + fbl.y) / 2, `h ${hgt.toFixed(1)}`, '#10b981');
      lbl(ctx, (ftr.x + btr.x) / 2 + 16, (ftr.y + btr.y) / 2 - 6, `w ${wd.toFixed(1)}`, '#4f46e5');
    } else {
      const R = rad * s, H = hgt * s;
      const ry = R * 0.32; // ellipse squash
      const x = cx, yTop = cy - H / 2, yBot = cy + H / 2;
      // body
      ctx.beginPath();
      ctx.moveTo(x - R, yTop);
      ctx.lineTo(x - R, yBot);
      ctx.ellipse(x, yBot, R, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + R, yTop);
      ctx.closePath();
      ctx.fillStyle = COLORS.face; ctx.fill();
      ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 2; ctx.stroke();
      // bottom front arc
      ctx.beginPath(); ctx.ellipse(x, yBot, R, ry, 0, 0, Math.PI); ctx.strokeStyle = COLORS.edge; ctx.stroke();
      // top ellipse
      ctx.beginPath(); ctx.ellipse(x, yTop, R, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.faceTop; ctx.fill();
      ctx.strokeStyle = COLORS.edge; ctx.stroke();
      // radius line
      ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + R, yTop);
      ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2; ctx.stroke();
      lbl(ctx, x + R / 2, yTop - 8, `r ${rad.toFixed(1)}`, '#0ea5e9');
      lbl(ctx, x - R - 16, cy, `h ${hgt.toFixed(1)}`, '#10b981');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [solid, l, wd, hgt, rad]);

  const vol = solid === 'box' ? l * wd * hgt : Math.PI * rad * rad * hgt;
  const area = solid === 'box'
    ? 2 * (l * wd + l * hgt + wd * hgt)
    : 2 * Math.PI * rad * rad + 2 * Math.PI * rad * hgt;
  const formula = solid === 'box'
    ? { v: 'V = l · w · h', a: 'SA = 2(lw + lh + wh)' }
    : { v: 'V = π r² h', a: 'SA = 2πr² + 2πr h' };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['box', 'cylinder'] as Solid[]).map((s) => (
          <button key={s} onClick={() => setSolid(s)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              solid === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {s}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          {solid === 'box' ? (
            <>
              <Slider label="length l" value={l} set={setL} color="#0ea5e9" />
              <Slider label="width w" value={wd} set={setWd} color="#4f46e5" />
              <Slider label="height h" value={hgt} set={setHgt} color="#10b981" />
            </>
          ) : (
            <>
              <Slider label="radius r" value={rad} set={setRad} color="#0ea5e9" />
              <Slider label="height h" value={hgt} set={setHgt} color="#10b981" />
            </>
          )}
          <div class="rounded-lg bg-surface-2 p-3 text-[0.8rem] leading-relaxed">
            <div class="flex justify-between"><span class="font-mono text-muted">{formula.a}</span><strong>{area.toFixed(2)}</strong></div>
            <div class="mt-1 flex justify-between"><span class="font-mono text-muted">{formula.v}</span><strong>{vol.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">Area is in square units; volume in cubic units.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, set, color }: { label: string; value: number; set: (n: number) => void; color: string }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted" style={`color:${color}`}>{label} = {value.toFixed(1)}</span>
      <input type="range" min={1} max={5} step={0.5} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full" style={`accent-color:${color}`} />
    </label>
  );
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 2; ctx.stroke();
}
function lbl(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.fillStyle = color; ctx.font = '700 11px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

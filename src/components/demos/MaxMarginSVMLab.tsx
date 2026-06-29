import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Max-margin classifier playground (soft-margin linear SVM).
   - Drag two classes of points (spam = red, ham = blue).
   - We fit w, b by subgradient descent on the soft-margin objective.
   - Shows the decision boundary, the ±1 margins, and the support vectors.
   - Toggle a quadratic feature map (the kernel trick) to bend the boundary
     around data that no straight line can separate.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number; label: 1 | -1 };
type Mode = 'linear' | 'kernel';

const COL = {
  pos: '#f43f5e',  // class +1 (e.g. spam)
  neg: '#0ea5e9',  // class -1 (e.g. ham)
  line: '#4f46e5',
  margin: 'rgba(79,70,229,0.45)',
  sv: '#10b981',
};

// feature map: linear -> [x, y]; kernel -> [x, y, x², y², xy] (degree-2 polynomial)
function phi(p: { x: number; y: number }, mode: Mode): number[] {
  return mode === 'linear' ? [p.x, p.y] : [p.x, p.y, p.x * p.x, p.y * p.y, p.x * p.y];
}

// soft-margin SVM via full-batch subgradient descent in feature space
function trainSVM(pts: Pt[], mode: Mode) {
  const dim = mode === 'linear' ? 2 : 5;
  let w = new Array(dim).fill(0);
  let b = 0;
  const lambda = 0.02;
  const lr = 0.05;
  const n = pts.length || 1;
  const feats = pts.map((p) => phi(p, mode));
  for (let it = 0; it < 4000; it++) {
    const gw = new Array(dim).fill(0);
    let gb = 0;
    for (let i = 0; i < pts.length; i++) {
      const f = feats[i], y = pts[i].label;
      let dot = b;
      for (let d = 0; d < dim; d++) dot += w[d] * f[d];
      if (y * dot < 1) { for (let d = 0; d < dim; d++) gw[d] -= y * f[d]; gb -= y; }
    }
    for (let d = 0; d < dim; d++) w[d] -= lr * (lambda * w[d] + gw[d] / n);
    b -= lr * (gb / n);
  }
  return { w, b, dim };
}

function makeInitial(): Pt[] {
  const pts: Pt[] = [];
  const pos = [[-2.4, 1.6], [-1.8, 2.4], [-2.8, 0.6], [-1.4, 1.0], [-3.0, 1.9]];
  const neg = [[2.2, -1.4], [1.6, -2.2], [2.8, -0.7], [1.2, -1.0], [3.0, -1.8]];
  for (const [x, y] of pos) pts.push({ x, y, label: 1 });
  for (const [x, y] of neg) pts.push({ x, y, label: -1 });
  return pts;
}
// a ring-vs-core layout that NO straight line can separate
function makeRing(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pts.push({ x: Math.cos(a) * 0.9, y: Math.sin(a) * 0.9, label: 1 }); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push({ x: Math.cos(a) * 3.1, y: Math.sin(a) * 3.1, label: -1 }); }
  return pts;
}

export default function MaxMarginSVMLab() {
  const [pts, setPts] = useState<Pt[]>(makeInitial);
  const [mode, setMode] = useState<Mode>('linear');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 460, h: 460, scale: 42, ox: 230, oy: 230 });
  const drag = useRef<number | null>(null);

  const model = useMemo(() => trainSVM(pts, mode), [pts, mode]);

  const decision = (p: { x: number; y: number }) => {
    const f = phi(p, mode);
    let s = model.b;
    for (let d = 0; d < model.dim; d++) s += model.w[d] * f[d];
    return s;
  };

  const RANGE = 4.2;
  const toMath = (px: number, py: number) => {
    const { scale, ox, oy } = size.current;
    return { x: (px - ox) / scale, y: (oy - py) / scale };
  };

  const draw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { w, h, scale, ox, oy } = size.current;
    const px = (x: number) => ox + x * scale;
    const py = (y: number) => oy - y * scale;
    ctx.clearRect(0, 0, w, h);

    // decision-region shading (sampled grid)
    const step = 8;
    for (let sx = 0; sx < w; sx += step) {
      for (let sy = 0; sy < h; sy += step) {
        const m = toMath(sx + step / 2, sy + step / 2);
        const s = decision(m);
        ctx.fillStyle = s >= 0 ? 'rgba(244,63,94,0.08)' : 'rgba(14,165,233,0.08)';
        ctx.fillRect(sx, sy, step, step);
      }
    }

    // grid + axes
    ctx.strokeStyle = 'rgba(128,128,128,0.16)'; ctx.lineWidth = 1;
    for (let g = -4; g <= 4; g++) { ctx.beginPath(); ctx.moveTo(px(g), 0); ctx.lineTo(px(g), h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, py(g)); ctx.lineTo(w, py(g)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(128,128,128,0.45)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(0), 0); ctx.lineTo(px(0), h); ctx.stroke();

    if (mode === 'linear') {
      // boundary w·x + b = c  ->  draw lines for c = 0, ±1
      const [wx, wy] = model.w; const b = model.b;
      const drawLine = (c: number, color: string, width: number, dash: number[]) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 200; i++) {
          const x = -RANGE - 0.5 + (i / 200) * (2 * RANGE + 1);
          let X: number, Y: number;
          if (Math.abs(wy) > Math.abs(wx)) { const y = (c - b - wx * x) / (wy || 1e-9); X = px(x); Y = py(y); }
          else { const y = -RANGE - 0.5 + (i / 200) * (2 * RANGE + 1); const xx = (c - b - wy * y) / (wx || 1e-9); X = px(xx); Y = py(y); }
          started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
        }
        ctx.stroke(); ctx.setLineDash([]);
      };
      drawLine(1, COL.margin, 1.5, [6, 5]);
      drawLine(-1, COL.margin, 1.5, [6, 5]);
      drawLine(0, COL.line, 3, []);
    } else {
      // curved boundary via marching over the shaded sign change is implicit;
      // overlay the zero contour by sampling columns
      ctx.strokeStyle = COL.line; ctx.lineWidth = 3;
      const N = 90;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x0 = -RANGE + (i / N) * 2 * RANGE, x1 = -RANGE + ((i + 1) / N) * 2 * RANGE;
          const y0 = -RANGE + (j / N) * 2 * RANGE;
          const s00 = decision({ x: x0, y: y0 }), s10 = decision({ x: x1, y: y0 });
          if (s00 === 0 || (s00 < 0) !== (s10 < 0)) { ctx.beginPath(); ctx.arc(px((x0 + x1) / 2), py(y0), 1.6, 0, Math.PI * 2); ctx.fillStyle = COL.line; ctx.fill(); }
        }
      }
    }

    // points (support vectors get an emerald ring)
    for (const p of pts) {
      const onMargin = Math.abs(decision(p)) <= 1.05;
      const X = px(p.x), Y = py(p.y);
      if (onMargin) { ctx.beginPath(); ctx.arc(X, Y, 10, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = COL.sv; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(X, Y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = p.label === 1 ? COL.pos : COL.neg; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    }
  };

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const resize = () => {
      const parent = cv.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const ctx = cv.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = w / (2 * RANGE + 0.6);
      size.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pts, model, mode]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const { scale, ox, oy } = size.current;
    let best = -1, bd = 18;
    pts.forEach((p, i) => { const d = Math.hypot(ox + p.x * scale - px, oy - p.y * scale - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { drag.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (drag.current === null) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    const cx = Math.max(-RANGE, Math.min(RANGE, m.x)), cy = Math.max(-RANGE, Math.min(RANGE, m.y));
    setPts((ps) => ps.map((p, i) => (i === drag.current ? { ...p, x: cx, y: cy } : p)));
  };
  const onUp = () => { drag.current = null; };

  const svCount = pts.filter((p) => Math.abs(decision(p)) <= 1.05).length;
  const margin = mode === 'linear' ? 1 / (Math.hypot(model.w[0], model.w[1]) || 1e-9) : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['linear', 'kernel'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {m === 'linear' ? 'Straight line' : 'Kernel (curved)'}
          </button>
        ))}
        <button onClick={() => { setPts(makeInitial()); setMode('linear'); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Separable preset</button>
        <button onClick={() => { setPts(makeRing()); setMode('kernel'); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Ring preset</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag any point. The classifier re-solves for the widest possible gap.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="support vectors" value={String(svCount)} color={COL.sv} />
            <Readout label="margin width" value={margin === null ? 'curved' : (2 * margin).toFixed(2)} />
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-muted">
            <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${COL.pos}`} /> class +1 (spam)</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${COL.neg}`} /> class −1 (ham)</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full border-2" style={`border-color:${COL.sv}`} /> support vector</span>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {mode === 'linear'
              ? 'Only the closest points — the support vectors — touch the dashed margins and pin the boundary. Drag a far-away point and nothing moves.'
              : 'In kernel mode we add the features x², y², xy. A flat boundary in that richer space looks curved here — the kernel trick. Try the Ring preset.'}
          </div>
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

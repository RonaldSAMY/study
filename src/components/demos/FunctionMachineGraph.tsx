import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Function machine + graph.
   - Pick a rule f(x). Slide an input x; the machine shows the output.
   - "Drop it in" records the (x, f(x)) point on the live graph.
   - Crisp devicePixelRatio canvas, responsive on resize.
   ------------------------------------------------------------------ */

type Rule = { key: string; label: string; f: (x: number) => number };
const RULES: Rule[] = [
  { key: 'lin', label: 'f(x) = 2x + 1', f: (x) => 2 * x + 1 },
  { key: 'sq', label: 'f(x) = x²', f: (x) => x * x },
  { key: 'aff', label: 'f(x) = 3x − 2', f: (x) => 3 * x - 2 },
  { key: 'half', label: 'f(x) = ½x + 3', f: (x) => 0.5 * x + 3 },
];

const COLORS = {
  curve: '#0ea5e9',
  point: '#10b981',
  recorded: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.6)',
};

export default function FunctionMachineGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ruleKey, setRuleKey] = useState('lin');
  const [x, setX] = useState(2);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const sizeRef = useRef({ w: 480, h: 360, scale: 22, ox: 240, oy: 270 });

  const rule = RULES.find((r) => r.key === ruleKey)!;
  const y = rule.f(x);

  const stateRef = useRef({ rule, x, y, pts });
  stateRef.current = { rule, x, y, pts };

  const toPx = (vx: number, vy: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + vx * scale, y: oy - vy * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    const st = stateRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // the curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const vx = (px - ox) / scale;
      const vy = st.rule.f(vx);
      const py = oy - vy * scale;
      if (py < -50 || py > h + 50) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // recorded points
    st.pts.forEach((p) => {
      const q = toPx(p.x, p.y);
      ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.recorded; ctx.fill();
    });

    // current point with guide lines
    const cur = toPx(st.x, st.y);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(16,185,129,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(cur.x, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(ox, cur.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cur.x, cur.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.point; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
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
      const scale = Math.max(14, Math.min(26, w / 18));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h * 0.62 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [ruleKey, x, pts]);

  const drop = () => setPts((p) => [...p.filter((q) => q.x !== x), { x, y }]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {RULES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setRuleKey(r.key); setPts([]); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              ruleKey === r.key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          {/* the machine */}
          <div class="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
            <div class="text-center">
              <p class="text-xs text-muted">input</p>
              <p class="font-mono text-xl font-bold" style={`color:${COLORS.point}`}>{x}</p>
            </div>
            <div class="flex-1 rounded-lg bg-brand px-2 py-3 text-center text-white">
              <p class="text-xs opacity-80">f</p>
              <p class="font-mono text-xs">{rule.label}</p>
            </div>
            <div class="text-center">
              <p class="text-xs text-muted">output</p>
              <p class="font-mono text-xl font-bold" style={`color:${COLORS.recorded}`}>{Number.isInteger(y) ? y : y.toFixed(1)}</p>
            </div>
          </div>

          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>input x = {x}</span>
            </span>
            <input
              type="range" min={-6} max={6} step={1} value={x}
              onInput={(e) => setX(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="flex items-center gap-2">
            <button
              onClick={drop}
              class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white transition hover:opacity-90"
            >
              drop x into the machine
            </button>
            <button
              onClick={() => setPts([])}
              class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted transition hover:text-text"
            >
              clear
            </button>
          </div>
          <p class="text-xs text-muted">
            Each input gives exactly <strong>one</strong> output — that is what makes it a function. Recorded
            points trace out the graph of f.
          </p>
        </div>
      </div>
    </div>
  );
}

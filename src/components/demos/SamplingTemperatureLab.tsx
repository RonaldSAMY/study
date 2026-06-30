import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Next-token sampling lab.
   - Fixed logits for 8 candidate next tokens.
   - Temperature reshapes the softmax; top-k and top-p prune the tail.
   - Hit "Sample" to draw a token from the final distribution.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const TOKENS = ['sunny', 'warm', 'nice', 'cloudy', 'cold', 'rainy', 'windy', 'grim'];
const LOGITS = [3.0, 2.6, 2.2, 1.8, 1.2, 0.8, 0.4, -0.6];

const COLORS = { keep: '#4f46e5', drop: 'rgba(128,128,128,0.35)', pick: '#10b981' };

function softmax(logits: number[], T: number) {
  const t = Math.max(0.05, T);
  const scaled = logits.map((l) => l / t);
  const m = Math.max(...scaled);
  const ex = scaled.map((v) => Math.exp(v - m));
  const z = ex.reduce((a, b) => a + b, 0) || 1;
  return ex.map((v) => v / z);
}

export default function SamplingTemperatureLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [T, setT] = useState(1);
  const [k, setK] = useState(8); // 8 = off
  const [p, setP] = useState(1); // 1 = off
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 300 });

  // base distribution from temperature
  const base = softmax(LOGITS, T);

  // top-k then top-p mask over the SORTED order
  const order = base.map((pr, i) => ({ i, pr })).sort((a, b) => b.pr - a.pr);
  const keep = new Set<number>();
  let cum = 0;
  order.forEach((o, rank) => {
    if (rank < k && cum < p) { keep.add(o.i); cum += o.pr; }
  });
  // renormalize survivors
  const zKeep = order.reduce((s, o) => (keep.has(o.i) ? s + o.pr : s), 0) || 1;
  const final = base.map((pr, i) => (keep.has(i) ? pr / zKeep : 0));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padB = 30, padT = 22, padL = 8, padR = 8;
    const n = TOKENS.length;
    const slot = (w - padL - padR) / n;
    const y0 = h - padB;
    const plotH = y0 - padT;
    const maxP = Math.max(...final, 0.001);

    for (let i = 0; i < n; i++) {
      const bw = slot * 0.66;
      const left = padL + slot * i + (slot - bw) / 2;
      const prob = final[i];
      const bh = (prob / maxP) * plotH;
      const isPick = picked === i || flash === i;
      ctx.fillStyle = prob === 0 ? COLORS.drop : isPick ? COLORS.pick : COLORS.keep;
      roundTop(ctx, left, y0 - bh, bw, bh, 5);
      ctx.fill();

      // probability label
      if (prob > 0) {
        ctx.fillStyle = isPick ? COLORS.pick : 'rgba(128,128,128,0.95)';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(prob.toFixed(2), left + bw / 2, y0 - bh - 6);
      }
      // token label
      ctx.fillStyle = prob === 0 ? 'rgba(128,128,128,0.5)' : 'rgba(128,128,128,0.95)';
      ctx.font = `${isPick ? '700' : '600'} 11px Inter, sans-serif`;
      ctx.fillText(TOKENS[i], left + bw / 2, y0 + 16);
    }
    // baseline
    ctx.strokeStyle = 'rgba(128,128,128,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(w - padR, y0); ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 300;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [T, k, p, picked, flash]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const sample = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const survivors = final.map((pr, i) => ({ pr, i })).filter((o) => o.pr > 0);
    if (survivors.length === 0) return;
    // weighted draw of the final token
    let r = Math.random();
    let chosen = survivors[survivors.length - 1].i;
    for (const o of survivors) { if (r < o.pr) { chosen = o.i; break; } r -= o.pr; }

    const start = performance.now();
    const dur = 850;
    setPicked(null);
    let nextStep = 0; // ms into the animation when we next change the flash
    let step = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= dur) {
        setFlash(null);
        setPicked(chosen);
        rafRef.current = null;
        return;
      }
      if (elapsed >= nextStep) {
        const s = survivors[step % survivors.length].i;
        setFlash(s);
        step += 1;
        // slow down as we approach the end
        nextStep = elapsed + 45 + 180 * (elapsed / dur) * (elapsed / dur);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const kLabel = k >= TOKENS.length ? 'off' : `${k}`;
  const pLabel = p >= 1 ? 'off' : p.toFixed(2);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-2 text-sm text-muted">Prompt: <em>"The weather today is ___"</em> — the model's logits are fixed; you control how they become a choice.</p>
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <label class="block">
          <span class="mb-1 block text-muted">temperature = {T.toFixed(2)}</span>
          <input type="range" min={0.1} max={2} step={0.05} value={T}
            onInput={(e) => setT(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">top-k = {kLabel}</span>
          <input type="range" min={1} max={8} step={1} value={k}
            onInput={(e) => setK(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">top-p = {pLabel}</span>
          <input type="range" min={0.1} max={1} step={0.05} value={p}
            onInput={(e) => setP(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={sample} class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          Sample a token
        </button>
        <span class="text-sm text-muted">
          {picked !== null
            ? <>chose <strong style={`color:${COLORS.pick}`}>"{TOKENS[picked]}"</strong></>
            : 'kept ' + [...keep].length + ' of 8 tokens'}
        </span>
      </div>

      <p class="mt-2 text-xs text-muted">
        Low temperature → spiky, near-greedy. High temperature → flat, adventurous. <strong>top-k</strong> keeps
        the k best tokens; <strong>top-p</strong> keeps the smallest set whose probability sums past p. Grey bars are pruned.
      </p>
    </div>
  );
}

function roundTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, Math.max(0, h));
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

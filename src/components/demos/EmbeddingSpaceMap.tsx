import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Embedding-space map.
   - "Similarity" mode: click any word; lines + colors rank every other
     word by cosine similarity (the angle between the two vectors).
   - "Analogy" mode: animate king - man + woman and watch the result
     vector land near "queen" (nearest by distance).
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

type Mode = 'similarity' | 'analogy';
type Word = { label: string; x: number; y: number; group: string };

const COLORS = {
  hi: '#10b981',
  q: '#4f46e5',
  k: '#0ea5e9',
  result: '#f59e0b',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// hand-placed 2D "embeddings" — semantically related words share a direction
const WORDS: Word[] = [
  { label: 'king', x: 7.0, y: 1.2, group: 'royalty' },
  { label: 'queen', x: 7.0, y: 3.2, group: 'royalty' },
  { label: 'prince', x: 8.0, y: 1.1, group: 'royalty' },
  { label: 'princess', x: 8.0, y: 3.1, group: 'royalty' },
  { label: 'man', x: 4.0, y: 1.0, group: 'people' },
  { label: 'woman', x: 4.0, y: 3.0, group: 'people' },
  { label: 'dog', x: 1.5, y: 6.0, group: 'animals' },
  { label: 'cat', x: 1.8, y: 6.2, group: 'animals' },
  { label: 'puppy', x: 1.3, y: 5.4, group: 'animals' },
  { label: 'bone', x: 0.6, y: 6.6, group: 'animals' },
];

const ANALOGIES: { a: string; b: string; c: string; label: string }[] = [
  { a: 'king', b: 'man', c: 'woman', label: 'king − man + woman' },
  { a: 'prince', b: 'man', c: 'woman', label: 'prince − man + woman' },
];

const find = (l: string) => WORDS.find((w) => w.label === l)!;
const cosine = (p: Word | { x: number; y: number }, q: Word) => {
  const dot = p.x * q.x + p.y * q.y;
  const mp = Math.hypot(p.x, p.y) || 1;
  const mq = Math.hypot(q.x, q.y) || 1;
  return dot / (mp * mq);
};

export default function EmbeddingSpaceMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>('similarity');
  const [selected, setSelected] = useState('king');
  const [analogyIdx, setAnalogyIdx] = useState(0);
  const [t, setT] = useState(1); // animation progress 0..1
  const sizeRef = useRef({ w: 480, h: 360, sx: 40, sy: 40, ox: 30, oy: 330 });

  const toPx = (x: number, y: number) => {
    const { sx, sy, ox, oy } = sizeRef.current;
    return { x: ox + x * sx, y: oy - y * sy };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // light grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 9; gx++) {
      const p = toPx(gx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
    }
    for (let gy = 0; gy <= 7; gy++) {
      const p = toPx(0, gy);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
    }
    // axes through origin
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    if (mode === 'similarity') {
      const sel = find(selected);
      // similarity lines from selected to every other word
      for (const wd of WORDS) {
        if (wd.label === selected) continue;
        const c = cosine(sel, wd);
        const a = Math.max(0, c); // only draw positive similarity
        if (a < 0.01) continue;
        ctx.strokeStyle = `rgba(16,185,129,${0.15 + 0.7 * a})`;
        ctx.lineWidth = 1 + 4 * a;
        const p1 = toPx(sel.x, sel.y);
        const p2 = toPx(wd.x, wd.y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      for (const wd of WORDS) dot(ctx, toPx(wd.x, wd.y), wd.label, wd.label === selected ? COLORS.q : COLORS.k, wd.label === selected);
    } else {
      const A = find(ANALOGIES[analogyIdx].a);
      const B = find(ANALOGIES[analogyIdx].b);
      const C = find(ANALOGIES[analogyIdx].c);
      // animated result = A - B + C   (interpolate the -B then +C steps via t)
      const half = Math.min(1, t * 2);
      const half2 = Math.max(0, t * 2 - 1);
      const stepA = { x: A.x - B.x * half, y: A.y - B.y * half };
      const res = { x: stepA.x + C.x * half2, y: stepA.y + C.y * half2 };

      // draw the arithmetic arrows
      arrow(ctx, toPx(0, 0), toPx(A.x, A.y), COLORS.q, 2.5);
      arrow(ctx, toPx(A.x, A.y), toPx(stepA.x, stepA.y), '#ef4444', 2.5);
      if (half2 > 0) arrow(ctx, toPx(stepA.x, stepA.y), toPx(res.x, res.y), COLORS.result, 2.5);

      for (const wd of WORDS) dot(ctx, toPx(wd.x, wd.y), wd.label, COLORS.k, false);
      // result marker
      const rp = toPx(res.x, res.y);
      ctx.beginPath(); ctx.arc(rp.x, rp.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.result; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 540);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ox = 30, oy = h - 30;
      sizeRef.current = { w, h, sx: (w - 50) / 9, sy: (h - 50) / 7, ox, oy };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [mode, selected, analogyIdx, t]);

  // animate the analogy when it changes / on demand
  const runAnalogy = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setT(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    setT(0);
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (mode === 'analogy') runAnalogy();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mode, analogyIdx]);

  const onClick = (e: MouseEvent) => {
    if (mode !== 'similarity') return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let best: string | null = null, bd = 26;
    for (const wd of WORDS) {
      const p = toPx(wd.x, wd.y);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = wd.label; }
    }
    if (best) setSelected(best);
  };

  // ranked similarities for the readout
  const sel = find(selected);
  const ranked = WORDS.filter((w) => w.label !== selected)
    .map((w) => ({ label: w.label, c: cosine(sel, w) }))
    .sort((a, b) => b.c - a.c);

  const an = ANALOGIES[analogyIdx];
  const A = find(an.a), B = find(an.b), C = find(an.c);
  const resVec = { x: A.x - B.x + C.x, y: A.y - B.y + C.y };
  const nearest = WORDS.filter((w) => ![an.a, an.b, an.c].includes(w.label))
    .map((w) => ({ label: w.label, d: Math.hypot(w.x - resVec.x, w.y - resVec.y) }))
    .sort((a, b) => a.d - b.d)[0];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['similarity', 'analogy'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'similarity' ? 'Cosine similarity' : 'Word analogy'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onClick={onClick}
        />

        <div class="space-y-3 text-sm">
          {mode === 'similarity' ? (
            <>
              <p class="text-muted">
                Click a word. Line thickness = <strong>cosine similarity</strong> (the angle between the
                two vectors). Selected: <strong style={`color:${COLORS.q}`}>{selected}</strong>.
              </p>
              <div class="rounded-lg bg-surface-2 p-3">
                <p class="mb-1 font-semibold text-text">Most similar to "{selected}":</p>
                <div class="space-y-1 font-mono text-xs">
                  {ranked.slice(0, 5).map((r) => (
                    <div key={r.label} class="flex items-center gap-2">
                      <span class="w-16">{r.label}</span>
                      <span class="h-2 rounded-full" style={`width:${Math.max(2, r.c * 90)}px;background:${COLORS.hi}`} />
                      <span class="text-muted">{r.c.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div class="flex flex-wrap gap-2">
                {ANALOGIES.map((a, i) => (
                  <button
                    key={a.label}
                    onClick={() => setAnalogyIdx(i)}
                    class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      analogyIdx === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p class="text-muted">
                Subtract <span style={`color:#ef4444`}>{an.b}</span>, then add{' '}
                <span style={`color:${COLORS.k}`}>{an.c}</span>. The{' '}
                <span style={`color:${COLORS.result}`}>orange</span> result lands on...
              </p>
              <div class="rounded-lg bg-surface-2 p-3">
                <div class="flex justify-between"><span class="text-muted">result vector</span><strong class="font-mono">({resVec.x.toFixed(1)}, {resVec.y.toFixed(1)})</strong></div>
                <div class="flex justify-between"><span class="text-muted">nearest word</span><strong style={`color:${COLORS.result}`}>{nearest.label}</strong></div>
              </div>
              <button onClick={runAnalogy} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
                Replay animation
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function dot(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, text: string, color: string, big: boolean) {
  ctx.beginPath(); ctx.arc(at.x, at.y, big ? 7 : 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  if (big) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  ctx.font = `${big ? '700' : '600'} 12px Inter, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 8, at.y - 7);
}
function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(ang - 0.4), to.y - head * Math.sin(ang - 0.4));
  ctx.lineTo(to.x - head * Math.cos(ang + 0.4), to.y - head * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

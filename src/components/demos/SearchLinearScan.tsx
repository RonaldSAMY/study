import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated LINEAR SEARCH.
   - Learner edits their own array + target, then scans left to right.
   - One cell is examined per step; passed cells grey out, the match
     lights up emerald. Live caption explains each comparison.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   - Canvas conventions: devicePixelRatio scaling, resize handling,
     class="touch-none", redraw via useEffect. Helpers live INSIDE
     the island so the file is self-contained.
   ------------------------------------------------------------------ */

const COLORS = { head: '#0ea5e9', found: '#10b981', brand: '#4f46e5' };

type Frame = { examined: number; status: 'checking' | 'found' | 'miss' | 'end' };

export default function SearchLinearScan() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 90 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [arrText, setArrText] = useState('8, 3, 9, 1, 6, 4, 7');
  const [targetText, setTargetText] = useState('6');
  const [arr, setArr] = useState<number[]>(() => [8, 3, 9, 1, 6, 4, 7]);
  const [target, setTarget] = useState(6);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // Precompute the step-frames (index-driven animation).
  const frames: Frame[] = (() => {
    const f: Frame[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === target) { f.push({ examined: i, status: 'found' }); return f; }
      f.push({ examined: i, status: 'checking' });
    }
    f.push({ examined: arr.length, status: 'end' });
    return f;
  })();
  const maxIdx = frames.length - 1;

  const parse = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
  const load = () => {
    const a = parse(arrText);
    const t = parseInt(targetText.trim(), 10);
    if (a.length && Number.isFinite(t)) { setArr(a); setTarget(t); setIdx(0); setPlaying(false); lastRef.current = 0; }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const n = arr.length;
    const gap = 6;
    const cw = Math.min(54, (w - gap * (n - 1)) / n);
    const totalW = cw * n + gap * (n - 1);
    const ox = (w - totalW) / 2;
    const cy = h / 2;
    const fr = frames[Math.min(idxRef.current, maxIdx)];
    const examined = fr.examined;

    for (let i = 0; i < n; i++) {
      const x = ox + i * (cw + gap);
      const y = cy - cw / 2;
      let fill = 'rgba(128,128,128,0.08)';
      let stroke = 'rgba(128,128,128,0.4)';
      let textColor = '#64748b';
      const isCur = i === examined && fr.status !== 'end';
      const isFound = i === examined && fr.status === 'found';
      if (isFound) { fill = COLORS.found; stroke = COLORS.found; textColor = '#fff'; }
      else if (isCur) { fill = COLORS.head; stroke = COLORS.head; textColor = '#fff'; }
      else if (i < examined) { fill = 'rgba(128,128,128,0.05)'; textColor = '#94a3b8'; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cw, cw, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `600 ${Math.round(cw * 0.36)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + cw / 2, cy);
      if (i < examined) {
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(x + 6, cy);
        ctx.lineTo(x + cw - 6, cy);
        ctx.stroke();
      }
      // index labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 ${Math.round(cw * 0.2)}px ui-monospace, monospace`;
      ctx.fillText(String(i), x + cw / 2, y + cw + 12);
    }
  };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 90;
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [arr, target, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > maxIdx) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, arr, target]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); lastRef.current = 0; } lastRef.current = 0; setPlaying((p) => !p); };

  const fr = frames[Math.min(idx, maxIdx)];
  const caption =
    fr.status === 'found'
      ? `arr[${fr.examined}] = ${arr[fr.examined]} equals target ${target} — found at index ${fr.examined}!`
      : fr.status === 'end'
        ? `Scanned every element without a match — target ${target} is not in the array. Return -1.`
        : `Check index ${fr.examined}: arr[${fr.examined}] = ${arr[fr.examined]} ${arr[fr.examined] === target ? '=' : '≠'} ${target}. ${arr[fr.examined] === target ? 'Match!' : 'No match, move one step right.'}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted">array
          <input value={arrText} onInput={(e) => setArrText((e.target as HTMLInputElement).value)} class="ml-1 w-48 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="text-xs text-muted">target
          <input value={targetText} onInput={(e) => setTargetText((e.target as HTMLInputElement).value)} class="ml-1 w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none" />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <p class="mt-2 text-xs text-muted">Comparisons so far: <span class="font-mono font-semibold text-text">{Math.min(idx + (fr.status === 'end' ? 0 : 1), arr.length)}</span> of up to {arr.length}.</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: the array need NOT be sorted — that is exactly when linear search is the right tool. Put the target last (or remove it) to feel the worst case.</p>
    </div>
  );
}

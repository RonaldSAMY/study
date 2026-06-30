import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated BINARY SEARCH VARIATIONS on a sorted array WITH DUPLICATES.
   - Four modes: first occurrence, last occurrence, lower bound
     (first index >= target), upper bound (first index > target).
   - Each step highlights lo/mid/hi, greys the eliminated half, and
     keeps a "best" marker. Live caption explains every branch.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   - Canvas conventions: dpr scaling, resize, touch-none, helpers inside.
   ------------------------------------------------------------------ */

const COLORS = { range: '#0ea5e9', mid: '#4f46e5', best: '#10b981' };
type Mode = 'first' | 'last' | 'lower' | 'upper';

type Frame = { lo: number; hi: number; mid: number; best: number; caption: string };

function buildFrames(mode: Mode, arr: number[], target: number): Frame[] {
  const f: Frame[] = [];
  const n = arr.length;
  if (mode === 'first' || mode === 'last') {
    let lo = 0, hi = n - 1, best = -1;
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (arr[mid] === target) {
        if (mode === 'first') {
          best = mid;
          f.push({ lo, hi, mid, best, caption: `arr[${mid}] = ${arr[mid]} = target → record ${mid} as a candidate, keep looking LEFT (hi = ${mid - 1}) for an earlier match.` });
          hi = mid - 1;
        } else {
          best = mid;
          f.push({ lo, hi, mid, best, caption: `arr[${mid}] = ${arr[mid]} = target → record ${mid} as a candidate, keep looking RIGHT (lo = ${mid + 1}) for a later match.` });
          lo = mid + 1;
        }
      } else if (arr[mid] < target) {
        f.push({ lo, hi, mid, best, caption: `arr[${mid}] = ${arr[mid]} < target ${target} → search RIGHT (lo = ${mid + 1}).` });
        lo = mid + 1;
      } else {
        f.push({ lo, hi, mid, best, caption: `arr[${mid}] = ${arr[mid]} > target ${target} → search LEFT (hi = ${mid - 1}).` });
        hi = mid - 1;
      }
    }
    f.push({ lo: -1, hi: -1, mid: -1, best, caption: best === -1 ? `Target ${target} never appears — return -1.` : `${mode === 'first' ? 'First' : 'Last'} occurrence of ${target} is index ${best}.` });
    return f;
  }
  // lower / upper bound — exclusive right boundary, converges to lo == hi
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const goRight = mode === 'lower' ? arr[mid] < target : arr[mid] <= target;
    if (goRight) {
      f.push({ lo, hi: hi - 1, mid, best: -1, caption: `arr[${mid}] = ${arr[mid]} ${mode === 'lower' ? '<' : '<='} ${target} → the boundary is to the RIGHT (lo = ${mid + 1}).` });
      lo = mid + 1;
    } else {
      f.push({ lo, hi: hi - 1, mid, best: -1, caption: `arr[${mid}] = ${arr[mid]} ${mode === 'lower' ? '>=' : '>'} ${target} → mid could be the boundary, search LEFT (hi = ${mid}).` });
      hi = mid;
    }
  }
  f.push({ lo: -1, hi: -1, mid: -1, best: lo, caption: `${mode === 'lower' ? 'Lower bound (first index >=' : 'Upper bound (first index >'} ${target}) = ${lo}${lo === n ? ' (past the end — every element is smaller)' : `, value ${arr[lo]}`}.` });
  return f;
}

export default function SearchBoundExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 110 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [arrText, setArrText] = useState('2, 4, 4, 4, 6, 6, 8, 9');
  const [targetText, setTargetText] = useState('4');
  const [arr, setArr] = useState<number[]>(() => [2, 4, 4, 4, 6, 6, 8, 9]);
  const [target, setTarget] = useState(4);
  const [mode, setMode] = useState<Mode>('first');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames = buildFrames(mode, arr, target);
  const maxIdx = frames.length - 1;

  const parse = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
  const load = () => {
    const a = parse(arrText).sort((x, y) => x - y);
    const t = parseInt(targetText.trim(), 10);
    if (a.length && Number.isFinite(t)) { setArr(a); setArrText(a.join(', ')); setTarget(t); setIdx(0); setPlaying(false); lastRef.current = 0; }
  };
  const pickMode = (m: Mode) => { setMode(m); setIdx(0); setPlaying(false); lastRef.current = 0; };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function textCss() {
    if (typeof window === 'undefined') return '#0f172a';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
    return v?.trim() || '#0f172a';
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const n = arr.length;
    const gap = 6;
    const cw = Math.min(50, (w - gap * (n - 1)) / n);
    const totalW = cw * n + gap * (n - 1);
    const ox = (w - totalW) / 2;
    const cy = h / 2 + 6;
    const fr = frames[Math.min(idxRef.current, maxIdx)];
    const tcol = textCss();

    for (let i = 0; i < n; i++) {
      const x = ox + i * (cw + gap);
      const y = cy - cw / 2;
      const inRange = fr.lo >= 0 && i >= fr.lo && i <= fr.hi;
      let fill = 'rgba(128,128,128,0.05)';
      let stroke = 'rgba(128,128,128,0.25)';
      let textColor = '#94a3b8';
      if (i === fr.best) { fill = COLORS.best; stroke = COLORS.best; textColor = '#fff'; }
      else if (i === fr.mid) { fill = COLORS.mid; stroke = COLORS.mid; textColor = '#fff'; }
      else if (inRange) { fill = 'rgba(14,165,233,0.12)'; stroke = COLORS.range; textColor = tcol; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cw, cw, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `600 ${Math.round(cw * 0.34)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + cw / 2, cy);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 ${Math.round(cw * 0.2)}px ui-monospace, monospace`;
      ctx.fillText(String(i), x + cw / 2, y + cw + 11);
      const tags: string[] = [];
      if (i === fr.lo) tags.push('lo');
      if (i === fr.hi) tags.push('hi');
      if (i === fr.mid) tags.push('mid');
      if (tags.length) {
        ctx.fillStyle = i === fr.mid ? COLORS.mid : COLORS.range;
        ctx.font = `700 ${Math.round(cw * 0.22)}px ui-monospace, monospace`;
        ctx.fillText(tags.join('/'), x + cw / 2, y - 10);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 110;
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
  useEffect(draw, [arr, target, mode, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
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
  }, [playing, speed, arr, target, mode]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };

  const fr = frames[Math.min(idx, maxIdx)];
  const labels: Record<Mode, string> = { first: 'First occurrence', last: 'Last occurrence', lower: 'Lower bound (≥)', upper: 'Upper bound (>)' };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['first', 'last', 'lower', 'upper'] as Mode[]).map((m) => (
          <button key={m} onClick={() => pickMode(m)} class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{labels[m]}</button>
        ))}
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted">sorted array
          <input value={arrText} onInput={(e) => setArrText((e.target as HTMLInputElement).value)} class="ml-1 w-56 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="text-xs text-muted">target
          <input value={targetText} onInput={(e) => setTargetText((e.target as HTMLInputElement).value)} class="ml-1 w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load &amp; sort</button>
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none" />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{fr.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: with duplicate 4s, watch how "first" keeps shrinking from the right and "last" from the left — same target, different boundary.</p>
    </div>
  );
}

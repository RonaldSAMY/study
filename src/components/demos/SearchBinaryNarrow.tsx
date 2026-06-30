import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated BINARY SEARCH on a sorted array.
   - Learner edits their own (auto-sorted) array + target.
   - Each step highlights lo / mid / hi and GREYS OUT the half that
     gets eliminated. Live caption: "mid=12 > target 7 -> search left".
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   - Canvas conventions: devicePixelRatio scaling, resize handling,
     class="touch-none", redraw via useEffect, helpers INSIDE island.
   ------------------------------------------------------------------ */

const COLORS = { lo: '#0ea5e9', hi: '#0ea5e9', mid: '#4f46e5', found: '#10b981' };

type Frame = { lo: number; hi: number; mid: number; kind: 'left' | 'right' | 'found' | 'miss' };

export default function SearchBinaryNarrow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 110 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [arrText, setArrText] = useState('1, 3, 5, 7, 9, 11, 13, 15, 17');
  const [targetText, setTargetText] = useState('7');
  const [arr, setArr] = useState<number[]>(() => [1, 3, 5, 7, 9, 11, 13, 15, 17]);
  const [target, setTarget] = useState(7);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // Precompute the frames: each frame is the state BEFORE narrowing.
  const frames: Frame[] = (() => {
    const f: Frame[] = [];
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (arr[mid] === target) { f.push({ lo, hi, mid, kind: 'found' }); return f; }
      if (arr[mid] < target) { f.push({ lo, hi, mid, kind: 'right' }); lo = mid + 1; }
      else { f.push({ lo, hi, mid, kind: 'left' }); hi = mid - 1; }
    }
    f.push({ lo: 0, hi: -1, mid: -1, kind: 'miss' });
    return f;
  })();
  const maxIdx = frames.length - 1;

  const parse = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
  const load = () => {
    const a = parse(arrText).sort((x, y) => x - y);
    const t = parseInt(targetText.trim(), 10);
    if (a.length && Number.isFinite(t)) { setArr(a); setArrText(a.join(', ')); setTarget(t); setIdx(0); setPlaying(false); lastRef.current = 0; }
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

    for (let i = 0; i < n; i++) {
      const x = ox + i * (cw + gap);
      const y = cy - cw / 2;
      const inRange = fr.kind !== 'miss' && i >= fr.lo && i <= fr.hi;
      let fill = 'rgba(128,128,128,0.05)';
      let stroke = 'rgba(128,128,128,0.25)';
      let textColor = '#94a3b8';
      if (fr.kind === 'found' && i === fr.mid) { fill = COLORS.found; stroke = COLORS.found; textColor = '#fff'; }
      else if (i === fr.mid) { fill = COLORS.mid; stroke = COLORS.mid; textColor = '#fff'; }
      else if (inRange) { fill = 'rgba(14,165,233,0.12)'; stroke = COLORS.lo; textColor = '#0f172a'; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cw, cw, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor === '#0f172a' ? getCss() : textColor;
      ctx.font = `600 ${Math.round(cw * 0.34)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + cw / 2, cy);
      // index label
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 ${Math.round(cw * 0.2)}px ui-monospace, monospace`;
      ctx.fillText(String(i), x + cw / 2, y + cw + 11);
      // lo / hi / mid pointers
      if (fr.kind !== 'miss') {
        const tags: string[] = [];
        if (i === fr.lo) tags.push('lo');
        if (i === fr.hi) tags.push('hi');
        if (i === fr.mid) tags.push('mid');
        if (tags.length) {
          ctx.fillStyle = i === fr.mid ? COLORS.mid : COLORS.lo;
          ctx.font = `700 ${Math.round(cw * 0.22)}px ui-monospace, monospace`;
          ctx.fillText(tags.join('/'), x + cw / 2, y - 10);
        }
      }
    }
  };

  function getCss() {
    // read the themed text color so cells are legible in dark mode
    if (typeof window === 'undefined') return '#0f172a';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
    return v?.trim() || '#0f172a';
  }

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
  useEffect(draw, [arr, target, idx]);

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
  }, [playing, speed, arr, target]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };

  const fr = frames[Math.min(idx, maxIdx)];
  const caption =
    fr.kind === 'found'
      ? `arr[${fr.mid}] = ${arr[fr.mid]} equals target ${target} — found at index ${fr.mid} in ${idx + 1} step${idx ? 's' : ''}.`
      : fr.kind === 'miss'
        ? `lo passed hi — the window is empty. Target ${target} is not in the array. Return -1.`
        : `mid = index ${fr.mid}, arr[${fr.mid}] = ${arr[fr.mid]} ${fr.kind === 'left' ? '>' : '<'} target ${target} → discard the ${fr.kind === 'left' ? 'right' : 'left'} half, search ${fr.kind} (${fr.kind === 'left' ? `hi = ${fr.mid - 1}` : `lo = ${fr.mid + 1}`}).`;

  const windowSize = fr.kind === 'miss' ? 0 : fr.hi - fr.lo + 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <p class="mt-2 text-xs text-muted">Window <span class="font-mono font-semibold text-text">[lo..hi]</span> holds <span class="font-mono font-semibold text-text">{windowSize}</span> candidate{windowSize === 1 ? '' : 's'} — it roughly halves every step.</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: the array is auto-sorted on Load — binary search REQUIRES sorted data. A nine-element array is solved in at most four steps.</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated JUMP SEARCH and EXPONENTIAL SEARCH on a sorted array.
   - Toggle algorithm. Jump: hop in sqrt(n) blocks, then linear-scan
     the block that must contain the target. Exponential: double the
     bound until it overshoots, then binary-search the last range.
   - Each step highlights the probe and shades the active range. Live
     caption per step. Transport: Back / Play / Pause / Step / Reset.
   - Canvas conventions: dpr scaling, resize, touch-none, helpers inside.
   ------------------------------------------------------------------ */

const COLORS = { range: '#0ea5e9', probe: '#4f46e5', found: '#10b981' };
type Algo = 'jump' | 'exp';
type Frame = { probe: number; lo: number; hi: number; found: boolean; caption: string };

function buildJump(arr: number[], target: number): Frame[] {
  const f: Frame[] = [];
  const n = arr.length;
  const step = Math.max(1, Math.floor(Math.sqrt(n)));
  let prev = 0;
  let curr = step;
  // Jump phase
  while (curr < n && arr[curr] < target) {
    f.push({ probe: curr, lo: prev, hi: curr, found: false, caption: `Jump phase: arr[${curr}] = ${arr[curr]} < target ${target} → skip this block, hop ahead by step ${step}.` });
    prev = curr;
    curr += step;
  }
  const blockHi = Math.min(curr, n - 1);
  f.push({ probe: Math.min(curr, n - 1), lo: prev, hi: blockHi, found: false, caption: curr >= n ? `Reached the end — the target, if present, is in the final block [${prev}..${blockHi}]. Scan it linearly.` : `arr[${curr}] = ${arr[curr]} ≥ target ${target} → overshot. The target must be in block [${prev}..${blockHi}]. Scan it linearly.` });
  // Linear scan phase inside the block
  for (let i = prev; i <= blockHi; i++) {
    if (arr[i] === target) { f.push({ probe: i, lo: prev, hi: blockHi, found: true, caption: `Scan: arr[${i}] = ${arr[i]} = target → found at index ${i}.` }); return f; }
    if (arr[i] > target) { f.push({ probe: i, lo: prev, hi: blockHi, found: false, caption: `Scan: arr[${i}] = ${arr[i]} > target ${target} — passed where it would be. Not present, return -1.` }); return f; }
    f.push({ probe: i, lo: prev, hi: blockHi, found: false, caption: `Scan: arr[${i}] = ${arr[i]} ≠ target ${target} → step one cell right.` });
  }
  f.push({ probe: -1, lo: prev, hi: blockHi, found: false, caption: `Block exhausted — target ${target} is not present. Return -1.` });
  return f;
}

function buildExp(arr: number[], target: number): Frame[] {
  const f: Frame[] = [];
  const n = arr.length;
  if (arr[0] === target) { f.push({ probe: 0, lo: 0, hi: 0, found: true, caption: `arr[0] = ${arr[0]} = target → found at index 0 immediately.` }); return f; }
  let bound = 1;
  while (bound < n && arr[bound] < target) {
    f.push({ probe: bound, lo: 0, hi: bound, found: false, caption: `Doubling: arr[${bound}] = ${arr[bound]} < target ${target} → range too small, double the bound to ${bound * 2}.` });
    bound *= 2;
  }
  const left = Math.floor(bound / 2);
  const right = Math.min(bound, n - 1);
  f.push({ probe: Math.min(bound, n - 1), lo: left, hi: right, found: false, caption: bound >= n ? `Bound ${bound} passed the end → binary-search the settled range [${left}..${right}].` : `arr[${bound}] = ${arr[bound]} ≥ target ${target} → stop doubling. Binary-search the range [${left}..${right}].` });
  // Binary search phase in [left, right]
  let lo = left, hi = right;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) { f.push({ probe: mid, lo, hi, found: true, caption: `Binary: arr[${mid}] = ${arr[mid]} = target → found at index ${mid}.` }); return f; }
    if (arr[mid] < target) { f.push({ probe: mid, lo, hi, found: false, caption: `Binary: arr[${mid}] = ${arr[mid]} < target ${target} → search right (lo = ${mid + 1}).` }); lo = mid + 1; }
    else { f.push({ probe: mid, lo, hi, found: false, caption: `Binary: arr[${mid}] = ${arr[mid]} > target ${target} → search left (hi = ${mid - 1}).` }); hi = mid - 1; }
  }
  f.push({ probe: -1, lo: -1, hi: -1, found: false, caption: `Range emptied — target ${target} is not present. Return -1.` });
  return f;
}

export default function SearchJumpExponential() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 110 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [arrText, setArrText] = useState('1, 2, 4, 7, 8, 11, 14, 19, 23, 27, 31, 36, 41, 48, 55, 60');
  const [targetText, setTargetText] = useState('19');
  const [arr, setArr] = useState<number[]>(() => [1, 2, 4, 7, 8, 11, 14, 19, 23, 27, 31, 36, 41, 48, 55, 60]);
  const [target, setTarget] = useState(19);
  const [algo, setAlgo] = useState<Algo>('jump');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames = algo === 'jump' ? buildJump(arr, target) : buildExp(arr, target);
  const maxIdx = frames.length - 1;

  const parse = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
  const load = () => {
    const a = parse(arrText).sort((x, y) => x - y);
    const t = parseInt(targetText.trim(), 10);
    if (a.length && Number.isFinite(t)) { setArr(a); setArrText(a.join(', ')); setTarget(t); setIdx(0); setPlaying(false); lastRef.current = 0; }
  };
  const pickAlgo = (a: Algo) => { setAlgo(a); setIdx(0); setPlaying(false); lastRef.current = 0; };

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
    const gap = 4;
    const cw = Math.min(40, (w - gap * (n - 1)) / n);
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
      let stroke = 'rgba(128,128,128,0.22)';
      let textColor = '#94a3b8';
      if (i === fr.probe && fr.found) { fill = COLORS.found; stroke = COLORS.found; textColor = '#fff'; }
      else if (i === fr.probe) { fill = COLORS.probe; stroke = COLORS.probe; textColor = '#fff'; }
      else if (inRange) { fill = 'rgba(14,165,233,0.12)'; stroke = COLORS.range; textColor = tcol; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cw, cw, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `600 ${Math.round(cw * 0.32)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + cw / 2, cy);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 ${Math.round(cw * 0.22)}px ui-monospace, monospace`;
      ctx.fillText(String(i), x + cw / 2, y + cw + 10);
      if (i === fr.probe) {
        ctx.fillStyle = fr.found ? COLORS.found : COLORS.probe;
        ctx.font = `700 ${Math.round(cw * 0.26)}px ui-monospace, monospace`;
        ctx.fillText('▲', x + cw / 2, y - 9);
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
  useEffect(draw, [arr, target, algo, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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
  }, [playing, speed, arr, target, algo]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };

  const fr = frames[Math.min(idx, maxIdx)];
  const step = Math.max(1, Math.floor(Math.sqrt(arr.length)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['jump', 'exp'] as Algo[]).map((a) => (
          <button key={a} onClick={() => pickAlgo(a)} class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${algo === a ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{a === 'jump' ? `Jump (step √n = ${step})` : 'Exponential (double)'}</button>
        ))}
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted">sorted array
          <input value={arrText} onInput={(e) => setArrText((e.target as HTMLInputElement).value)} class="ml-1 w-72 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
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
      <p class="mt-2 text-center text-xs text-muted">Tip: a small target like 2 finishes almost instantly with exponential search — it only doubles a few times near the front.</p>
    </div>
  );
}

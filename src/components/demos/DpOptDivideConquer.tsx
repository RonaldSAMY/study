import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Divide & Conquer DP optimization — optimal-split monotonicity.
   - Edit the array. We compute dp[j] = min over k<j of
       prev[k] + (sum of a[k+1..j])^2,
     i.e. the best place to cut a prefix into two groups. opt[j] is
     that best split point, and it is NON-DECREASING in j.
   - D&C resolves the MIDDLE j first, then recurses: the left half can
     only use k <= opt[mid], the right half only k >= opt[mid]. The
     shrinking [kLo,kHi] window is shown as an indigo band; resolved
     opt[j] points form a monotone staircase.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { opt: '#10b981', band: 'rgba(79,70,229,0.22)', mid: '#4f46e5', grid: 'rgba(128,128,128,0.18)' };

type Frame = { jMid: number; kLo: number; kHi: number; bestK: number; val: number; evals: number };

function parseArr(s: string): number[] {
  return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 12);
}

export default function DpOptDivideConquer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('3, 1, 4, 1, 5, 9, 2, 6');
  const [arr, setArr] = useState<number[]>(() => parseArr('3, 1, 4, 1, 5, 9, 2, 6'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  idxRef.current = idx;

  const built = (() => {
    const n = arr.length;
    const prefix = [0];
    for (const x of arr) prefix.push(prefix[prefix.length - 1] + x);
    const seg = (i: number, j: number) => prefix[j + 1] - prefix[i]; // sum a[i..j]
    const prev = arr.map((_, j) => seg(0, j) * seg(0, j));           // one group on [0..j]
    const cost = (k: number, j: number) => { const s = seg(k + 1, j); return s * s; };

    const frames: Frame[] = [];
    const opt = Array(n).fill(-1);
    let naive = 0;
    const solve = (jLo: number, jHi: number, kLo: number, kHi: number) => {
      if (jLo > jHi) return;
      const jMid = (jLo + jHi) >> 1;
      let bestK = kLo, bestVal = Infinity, evals = 0;
      const kEnd = Math.min(kHi, jMid - 1);
      for (let k = kLo; k <= kEnd; k++) { evals++; const v = prev[k] + cost(k, jMid); if (v < bestVal) { bestVal = v; bestK = k; } }
      opt[jMid] = bestK;
      frames.push({ jMid, kLo, kHi: kEnd, bestK, val: bestVal, evals });
      solve(jLo, jMid - 1, kLo, bestK);
      solve(jMid + 1, jHi, bestK, kHi);
    };
    if (n >= 2) solve(1, n - 1, 0, n - 1);
    for (let j = 1; j < n; j++) naive += j; // naive scans 0..j-1

    const dcEvals = frames.reduce((a, f) => a + f.evals, 0);
    return { n, frames, dcEvals, naive };
  })();

  const { n, frames } = built;
  const total = frames.length;
  const cur = total ? frames[Math.min(idx, total - 1)] : null;
  const resolved = frames.slice(0, Math.min(idx + 1, total));

  const commit = () => { const p = parseArr(text); if (p.length >= 2) { setArr(p); setIdx(0); setPlaying(false); } };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padL = 34, padB = 26, padT = 12, padR = 12;
    const gw = w - padL - padR, gh = h - padT - padB;
    const cw = gw / n, ch = gh / n;
    const X = (j: number) => padL + (j + 0.5) * cw;
    const Y = (k: number) => padT + gh - (k + 0.5) * ch; // k increases upward

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let j = 0; j <= n; j++) { ctx.beginPath(); ctx.moveTo(padL + j * cw, padT); ctx.lineTo(padL + j * cw, padT + gh); ctx.stroke(); }
    for (let k = 0; k <= n; k++) { ctx.beginPath(); ctx.moveTo(padL, padT + k * ch); ctx.lineTo(padL + gw, padT + k * ch); ctx.stroke(); }
    // axis labels
    ctx.fillStyle = '#888'; ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let j = 0; j < n; j++) ctx.fillText(String(j), X(j), padT + gh + 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k < n; k++) ctx.fillText(String(k), padL - 5, Y(k));

    // current scan band
    if (cur) {
      ctx.fillStyle = COLORS.band;
      const kTop = Y(cur.kHi) - ch / 2;
      const bandH = (cur.kHi - cur.kLo + 1) * ch;
      ctx.fillRect(padL + cur.jMid * cw, kTop, cw, bandH);
      ctx.strokeStyle = COLORS.mid; ctx.lineWidth = 2;
      ctx.strokeRect(padL + cur.jMid * cw + 1, padT, cw - 2, gh);
    }
    // resolved opt points (staircase)
    ctx.strokeStyle = COLORS.opt; ctx.lineWidth = 2;
    const pts = resolved.slice().sort((a, b) => a.jMid - b.jMid).map((f) => [X(f.jMid), Y(f.bestK)] as [number, number]);
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
    ctx.stroke();
    for (const f of resolved) {
      const isCur = cur && f.jMid === cur.jMid;
      ctx.beginPath(); ctx.arc(X(f.jMid), Y(f.bestK), isCur ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? COLORS.mid : COLORS.opt; ctx.fill();
      if (isCur) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = Math.round(w * 0.72);
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
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, arr]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, arr, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const evalsDone = resolved.reduce((a, f) => a + f.evals, 0);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Vertical axis = split point <span class="font-mono">k</span>, horizontal = prefix end <span class="font-mono">j</span>. Green dots are <span style={`color:${COLORS.opt}`}>opt[j]</span>; the indigo band is the only range D&amp;C still has to scan.</p>
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">
            {cur
              ? `j=${cur.jMid}: scanned k in [${cur.kLo}..${cur.kHi}] (${cur.evals} checks), best split after index ${cur.bestK}, cost=${cur.val}. Left/right halves inherit a narrower k-range.`
              : 'Press Play to resolve the middle j first, then recurse into the narrowed ranges.'}
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">D&amp;C checks so far</span><div class="font-mono font-semibold" style={`color:${COLORS.opt}`}>{evalsDone}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">naive checks (full)</span><div class="font-mono font-semibold text-muted">{built.naive}</div></div>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs text-muted">{Math.min(idx + 1, total)}/{total}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">The opt[j] staircase only ever climbs — that monotonicity is what lets D&amp;C skip the grey cells.</p>
    </div>
  );
}

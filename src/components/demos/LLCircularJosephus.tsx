import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated circular linked list, drawn as a ring so the tail -> head
   link (amber) is visible. Two modes:
   - Ring walk: a current pointer steps around and wraps past the tail
     straight back to the head — the loop never ends.
   - Josephus: n people sit in a circle, every k-th is eliminated
     (count k, remove, continue from the next survivor) until one
     person remains.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Mode = 'ring' | 'josephus';
type Frame = {
  alive: boolean[];
  current: number;       // highlighted node index
  count: number;         // counting label (0 = none)
  eliminated: number;    // index just eliminated (-1 = none)
  survivor: number;      // -1 unless solved
  wrap: boolean;         // current step wrapped tail -> head
  caption: string;
};

const COLORS = { node: '#4f46e5', cur: '#0ea5e9', gone: 'rgba(148,163,184,0.35)', win: '#10b981', wrap: '#f59e0b' };

function ringFrames(n: number): Frame[] {
  const alive = Array(n).fill(true);
  const out: Frame[] = [{ alive, current: 0, count: 0, eliminated: -1, survivor: -1, wrap: false, caption: 'current = head (person 1). Press Play to walk around the ring.' }];
  let cur = 0;
  const steps = n + Math.ceil(n / 2);
  for (let i = 0; i < steps; i++) {
    const wrap = cur === n - 1;
    cur = (cur + 1) % n;
    out.push({ alive, current: cur, count: 0, eliminated: -1, survivor: -1, wrap, caption: wrap ? `tail.next is the head, so current wraps back to person ${cur + 1}. A circular list has no null end.` : `current = current.next -> person ${cur + 1}.` });
  }
  return out;
}

function josephusFrames(n: number, k: number): Frame[] {
  const alive = Array(n).fill(true);
  const out: Frame[] = [{ alive: [...alive], current: 0, count: 0, eliminated: -1, survivor: -1, wrap: false, caption: `${n} people in a circle, counting off by ${k}. Start at person 1.` }];
  const nextAlive = (i: number): number => { let j = (i + 1) % n; while (!alive[j]) j = (j + 1) % n; return j; };
  let cur = 0;
  let remaining = n;
  while (remaining > 1) {
    for (let c = 1; c < k; c++) {
      cur = nextAlive(cur);
      out.push({ alive: [...alive], current: cur, count: c + 1, eliminated: -1, survivor: -1, wrap: false, caption: `count ${c + 1}: person ${cur + 1}.` });
    }
    // cur is the k-th counted -> eliminate
    alive[cur] = false;
    remaining--;
    out.push({ alive: [...alive], current: cur, count: 0, eliminated: cur, survivor: -1, wrap: false, caption: `Person ${cur + 1} is the ${k}th count — eliminated. The ring re-links around them.` });
    if (remaining > 1) {
      cur = nextAlive(cur);
      out.push({ alive: [...alive], current: cur, count: 1, eliminated: -1, survivor: -1, wrap: false, caption: `Resume counting from person ${cur + 1} (count 1).` });
    }
  }
  const survivor = alive.findIndex(Boolean);
  out.push({ alive: [...alive], current: survivor, count: 0, eliminated: -1, survivor, wrap: false, caption: `Person ${survivor + 1} survives — the Josephus position for n=${n}, k=${k}.` });
  return out;
}

export default function LLCircularJosephus() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 420, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [mode, setMode] = useState<Mode>('josephus');
  const [n, setN] = useState(7);
  const [k, setK] = useState(3);
  const [frames, setFrames] = useState<Frame[]>(() => josephusFrames(7, 3));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const rebuild = (m: Mode, nn: number, kk: number) => {
    const cn = Math.max(2, Math.min(12, nn));
    const ck = Math.max(2, Math.min(9, kk));
    setFrames(m === 'ring' ? ringFrames(cn) : josephusFrames(cn, ck));
    setIdx(0); setPlaying(false); lastRef.current = 0;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idx, frames.length - 1)];
    if (!f) return;
    const cnt = f.alive.length;
    const cxc = w / 2, cyc = h / 2;
    const R = Math.min(w, h) / 2 - 38;
    const nr = Math.max(16, Math.min(24, (2 * Math.PI * R) / cnt / 2.6));

    const pos = (i: number) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / cnt;
      return { x: cxc + R * Math.cos(a), y: cyc + R * Math.sin(a) };
    };
    const nextAlive = (i: number) => { let j = (i + 1) % cnt; let guard = 0; while (!f.alive[j] && guard++ < cnt) j = (j + 1) % cnt; return j; };

    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, lw = 2) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
      const a = Math.atan2(y2 - y1, x2 - x1);
      const sx = x1 + nr * Math.cos(a), sy = y1 + nr * Math.sin(a);
      const ex = x2 - nr * Math.cos(a), ey = y2 - nr * Math.sin(a);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(a - 0.4), ey - 8 * Math.sin(a - 0.4));
      ctx.lineTo(ex - 8 * Math.cos(a + 0.4), ey - 8 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    };

    // links between alive nodes (the wrap to the smallest-index alive node is amber)
    const aliveIdx = f.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    if (aliveIdx.length > 1) {
      for (const i of aliveIdx) {
        const j = nextAlive(i);
        const p1 = pos(i), p2 = pos(j);
        const isWrap = j <= i; // wrapped around the ring
        arrow(p1.x, p1.y, p2.x, p2.y, isWrap ? COLORS.wrap : 'rgba(148,163,184,0.85)', isWrap ? 2.6 : 2);
      }
    }

    // nodes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < cnt; i++) {
      const p = pos(i);
      const dead = !f.alive[i];
      const isCur = f.current === i && !dead;
      const isWin = f.survivor === i;
      ctx.beginPath(); ctx.arc(p.x, p.y, nr, 0, Math.PI * 2);
      if (dead) { ctx.fillStyle = COLORS.gone; ctx.fill(); }
      else { ctx.fillStyle = isWin ? COLORS.win : isCur ? COLORS.cur : COLORS.node; ctx.fill(); }
      if (isCur || isWin) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      ctx.fillStyle = dead ? '#64748b' : '#fff';
      ctx.font = `bold ${Math.round(nr * 0.85)}px ui-monospace, monospace`;
      ctx.fillText(String(i + 1), p.x, p.y);
      // count badge
      if (f.count > 0 && f.current === i && !dead) {
        const bx = p.x + nr * 0.9, by = p.y - nr * 0.9;
        ctx.beginPath(); ctx.arc(bx, by, nr * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.wrap; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(nr * 0.55)}px ui-sans-serif, system-ui`;
        ctx.fillText(String(f.count), bx, by);
      }
    }

    // head label
    const hp = pos(0);
    ctx.fillStyle = '#94a3b8'; ctx.font = `bold ${Math.round(nr * 0.6)}px ui-sans-serif, system-ui`;
    ctx.fillText('head', hp.x, hp.y - nr - 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 440);
      const h = 320;
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [frames, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((x) => Math.min(frames.length - 1, x + 1)); };
  const stepB = () => { setPlaying(false); setIdx((x) => Math.max(0, x - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['ring', 'josephus'] as Mode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); rebuild(m, n, k); }} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m === 'ring' ? 'Ring walk' : 'Josephus'}</button>
        ))}
        <label class="flex items-center gap-1 text-xs text-muted">n
          <input type="number" min={2} max={12} value={n} onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10) || 2; setN(v); rebuild(mode, v, k); }} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        {mode === 'josephus' && (
          <label class="flex items-center gap-1 text-xs text-muted">k
            <input type="number" min={2} max={9} value={k} onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10) || 2; setK(v); rebuild(mode, n, v); }} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
          </label>
        )}
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frames[Math.min(idx, frames.length - 1)]?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">{Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">The amber arrow is the tail-to-head link that closes the ring. Eliminated people are skipped, and the ring keeps shrinking.</p>
    </div>
  );
}

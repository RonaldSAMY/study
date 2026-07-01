import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated CAP theorem.
   - Five replicas start consistent. A network partition splits them
     into a majority side {0,1,2} and a minority side {3,4}.
   - A write arrives during the partition. Toggle CP vs AP, and choose
     which side the write hits, to see the trade-off:
       CP: the side without quorum refuses -> consistency kept, availability lost.
       AP: both sides accept -> availability kept, data diverges, reconcile on heal.
   Canvas conventions: devicePixelRatio scaling, resize handler,
   touch-none, redraw via useEffect. rAF autoplay cancelled on
   pause / unmount. Helpers live inside the island.
   ------------------------------------------------------------------ */

const N = 5;
const LEFT = [0, 1, 2];
const RIGHT = [3, 4];
const VALCOLOR: Record<string, string> = { v0: 'rgba(128,128,128,0.5)', v1: '#0ea5e9', v2: '#4f46e5' };

type Mode = 'CP' | 'AP';
type Side = 'majority' | 'minority';

function computeState(step: number, mode: Mode, side: Side) {
  const values = new Array<string>(N).fill('v0');
  let partitioned = false;
  let rejected = false;
  const writeNodes = side === 'majority' ? LEFT : RIGHT;
  const hasQuorum = writeNodes.length > N / 2;

  if (step >= 1) for (let i = 0; i < N; i++) values[i] = 'v1';
  if (step >= 2) partitioned = true;
  if (step >= 4) {
    if (mode === 'CP') {
      if (hasQuorum) writeNodes.forEach((i) => (values[i] = 'v2'));
      else rejected = true; // stays v1 everywhere, write fails
    } else {
      writeNodes.forEach((i) => (values[i] = 'v2')); // AP: this side diverges
    }
  }
  if (step >= 5) {
    partitioned = false;
    if (mode === 'CP') {
      if (hasQuorum) values.fill('v2');
      else values.fill('v1');
    } else {
      values.fill('v2'); // last-writer-wins picks the newer v2
    }
    rejected = false;
  }
  return { values, partitioned, rejected, writeNodes, hasQuorum };
}

export default function SysCapPartition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 220 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const STEPS = 5; // 0..5
  const [mode, setMode] = useState<Mode>('CP');
  const [side, setSide] = useState<Side>('minority');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  idxRef.current = idx;
  const modeRef = useRef(mode); modeRef.current = mode;
  const sideRef = useRef(side); sideRef.current = side;

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1050 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= STEPS + 1) { setIdx(STEPS); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, mode, side]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const st = computeState(idxRef.current, modeRef.current, sideRef.current);
    const cy = h / 2 + 6;
    const r = 24;
    const xs = [w * 0.12, w * 0.27, w * 0.42, w * 0.66, w * 0.81];

    // links between adjacent nodes (break the 2-3 link when partitioned)
    for (let i = 0; i < N - 1; i++) {
      const broken = st.partitioned && i === 2;
      ctx.beginPath();
      ctx.moveTo(xs[i] + r, cy);
      ctx.lineTo(xs[i + 1] - r, cy);
      ctx.strokeStyle = broken ? 'rgba(244,63,94,0.5)' : 'rgba(128,128,128,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash(broken ? [5, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // partition gap marker
    if (st.partitioned) {
      const gx = (xs[2] + xs[3]) / 2;
      ctx.strokeStyle = 'rgba(244,63,94,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx - 6, cy - 40); ctx.lineTo(gx + 6, cy - 20);
      ctx.moveTo(gx + 6, cy - 20); ctx.lineTo(gx - 6, cy);
      ctx.moveTo(gx - 6, cy); ctx.lineTo(gx + 6, cy + 20);
      ctx.moveTo(gx + 6, cy + 20); ctx.lineTo(gx - 6, cy + 40);
      ctx.stroke();
    }

    const writing = idxRef.current >= 3 && idxRef.current <= 4;
    for (let i = 0; i < N; i++) {
      const v = st.values[i];
      const isWriteTarget = writing && st.writeNodes.includes(i);
      ctx.beginPath();
      ctx.arc(xs[i], cy, r, 0, Math.PI * 2);
      ctx.fillStyle = VALCOLOR[v] || VALCOLOR.v0;
      ctx.fill();
      ctx.lineWidth = isWriteTarget ? 4 : 2.5;
      ctx.strokeStyle = isWriteTarget ? '#f59e0b' : '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v, xs[i], cy);
      ctx.fillStyle = 'rgba(128,128,128,0.7)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`n${i}`, xs[i], cy + r + 12);
    }

    // group labels
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (st.partitioned) {
      ctx.fillText('majority (has quorum)', (xs[0] + xs[2]) / 2, cy - r - 16);
      ctx.fillText('minority', (xs[3] + xs[4]) / 2, cy - r - 16);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 220;
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

  useEffect(draw, [idx, mode, side]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(STEPS, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= STEPS) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const st = computeState(idx, mode, side);
  const sideNodes = side === 'majority' ? 'n0,n1,n2' : 'n3,n4';
  const captions: string[] = [
    'Five replicas, all holding v0. Press Play.',
    'Client writes v1 → replicated to all 5. The cluster is consistent.',
    'Network partition! {n0,n1,n2} and {n3,n4} can no longer talk to each other.',
    `Client tries to write v2 on the ${side} side (${sideNodes}).`,
    mode === 'CP'
      ? (st.hasQuorum ? 'CP: the majority side has quorum → write accepted. The minority side is unavailable to stay consistent.' : 'CP: the minority side has NO quorum → write REJECTED. Consistency preserved, availability sacrificed.')
      : `AP: this side accepts the write anyway → the two sides now DIVERGE (v2 vs v1). Available, but inconsistent.`,
    mode === 'CP'
      ? (st.hasQuorum ? 'Partition heals: minority catches up. All nodes = v2, consistent throughout.' : 'Partition heals: the failed write never happened. All nodes = v1; the client had to retry.')
      : 'Partition heals: the conflict is reconciled (last-writer-wins → v2). Consistency is restored eventually.',
  ];
  const caption = captions[Math.min(idx, captions.length - 1)];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="flex rounded-lg border border-border bg-surface-2 p-0.5">
          {(['CP', 'AP'] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); }} class={`rounded-md px-3 py-1 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}>
              {m === 'CP' ? 'CP (consistency)' : 'AP (availability)'}
            </button>
          ))}
        </div>
        <div class="flex rounded-lg border border-border bg-surface-2 p-0.5">
          {(['majority', 'minority'] as Side[]).map((s) => (
            <button key={s} onClick={() => { setSide(s); }} class={`rounded-md px-3 py-1 text-sm font-semibold capitalize transition ${side === s ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}>
              write on {s}
            </button>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {st.rejected && idx >= 4 && idx < 5 && (
        <p class="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style="background:#f43f5e">
          429 / write refused — a CP system would rather be unavailable than return stale or conflicting data.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: try CP + "write on minority" to see a refused write, then AP + the same to see divergence — the two horns of CAP.</p>
    </div>
  );
}

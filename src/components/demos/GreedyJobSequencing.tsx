import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Job sequencing with deadlines.
   - Each unit-time job has a profit and a deadline. Edit them as
     "profit/deadline" entries. The demo sorts jobs by PROFIT (richest
     first) and, for each, drops it into the LATEST free slot at or
     before its deadline — keeping earlier slots open for jobs that may
     have tighter deadlines later.
   - The greedy choice: take the most profitable job we can still fit,
     placed as late as legal.
   - Slot grid (DOM) fills as jobs are placed or rejected.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { place: '#10b981', cur: '#0ea5e9', reject: '#ef4444', brand: '#4f46e5' };

type Job = { profit: number; deadline: number; label: string };
type Frame = { job: number; placedSlot: number | null; slots: (number | null)[]; profitAfter: number };

const parse = (s: string): Job[] => {
  const out: Job[] = [];
  let n = 0;
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) continue;
    const p = parseInt(m[1], 10), d = parseInt(m[2], 10);
    if (p > 0 && d > 0) { out.push({ profit: p, deadline: d, label: 'J' + (n + 1) }); n++; }
  }
  return out;
};

function computeFrames(sortedJobs: Job[], maxDeadline: number): Frame[] {
  const frames: Frame[] = [];
  const slots: (number | null)[] = new Array(maxDeadline).fill(null); // store job index in sortedJobs
  let profit = 0;
  for (let j = 0; j < sortedJobs.length; j++) {
    const job = sortedJobs[j];
    let placed: number | null = null;
    for (let slot = Math.min(job.deadline, maxDeadline) - 1; slot >= 0; slot--) {
      if (slots[slot] === null) { slots[slot] = j; placed = slot; profit += job.profit; break; }
    }
    frames.push({ job: j, placedSlot: placed, slots: [...slots], profitAfter: profit });
  }
  return frames;
}

export default function GreedyJobSequencing() {
  const [text, setText] = useState('100/2, 19/1, 27/2, 25/1, 15/3');
  const [jobs, setJobs] = useState<Job[]>(() => parse('100/2, 19/1, 27/2, 25/1, 15/3'));

  const sortedJobs = [...jobs].sort((a, b) => b.profit - a.profit);
  const maxDeadline = Math.max(1, ...jobs.map((j) => j.deadline));
  const frames = computeFrames(sortedJobs, maxDeadline);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => { const p = parse(text); if (p.length) { setJobs(p); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length + 1) { setIdx(frames.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, jobs]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = idx > 0 ? frames[idx - 1] : null;
  const slots = cur ? cur.slots : new Array(maxDeadline).fill(null);
  const profit = cur ? cur.profitAfter : 0;
  const curJob = cur ? sortedJobs[cur.job] : null;
  const nextJob = idx < frames.length ? sortedJobs[idx] : null;
  const done = idx >= frames.length;

  const caption = idx === 0
    ? 'Sorted by profit, richest first. Each job claims the latest free slot up to its deadline, leaving early slots for tighter jobs.'
    : cur!.placedSlot !== null
      ? `${curJob!.label} (profit ${curJob!.profit}, deadline ${curJob!.deadline}) → placed in slot ${cur!.placedSlot + 1}, the latest free slot ≤ ${curJob!.deadline}.`
      : `${curJob!.label} (profit ${curJob!.profit}, deadline ${curJob!.deadline}) → every slot ≤ ${curJob!.deadline} is taken, so it is rejected.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="profit/deadline, e.g. 100/2, 27/2" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* job queue sorted by profit */}
      <div class="flex flex-wrap gap-1.5 text-xs font-mono">
        {sortedJobs.map((j, i) => {
          const isNext = nextJob && i === idx;
          const processed = i < idx;
          const placed = processed && frames[i].placedSlot !== null;
          return (
            <span key={j.label} class={`rounded-md border px-2 py-1 transition ${isNext ? 'scale-110 border-transparent text-white' : processed ? `border-border ${placed ? 'text-text' : 'text-muted line-through'}` : 'border-border bg-surface-2 text-text'}`} style={isNext ? `background:${COLORS.cur}` : ''}>
              {j.label} <span class="text-muted">${j.profit}·d{j.deadline}</span>
            </span>
          );
        })}
      </div>

      {/* slot grid */}
      <div class="mt-3 flex flex-wrap gap-2">
        {slots.map((s, i) => {
          const jobHere = s !== null ? sortedJobs[s] : null;
          const justPlaced = cur && cur.placedSlot === i;
          return (
            <div key={i} class="flex flex-col items-center gap-1">
              <div class={`flex h-16 w-16 items-center justify-center rounded-lg border-2 text-sm font-bold transition ${jobHere ? 'border-transparent text-white' : 'border-dashed border-border text-muted'}`} style={jobHere ? `background:${justPlaced ? COLORS.cur : COLORS.place}` : ''}>
                {jobHere ? jobHere.label : '—'}
              </div>
              <span class="text-xs text-muted">slot {i + 1}</span>
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <p class="mt-2 font-mono text-sm text-text">total profit: <span class="font-bold" style="color:#10b981">{profit}</span></p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Final profit {profit}. Placing each job as late as legal is the exchange-argument trick: it never blocks a job that could have used an earlier slot.
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
      <p class="mt-2 text-center text-xs text-muted">Each job is "profit/deadline" and takes one time slot. Struck-through jobs were rejected — no free slot before their deadline.</p>
    </div>
  );
}

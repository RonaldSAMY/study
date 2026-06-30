import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated balanced-brackets scanner.
   - Edit a string of brackets. The demo scans left to right: every
     opening bracket is PUSHED; every closing bracket must match the
     bracket on TOP of the stack, which is then POPPED.
   - A mismatch (or a close with an empty stack) is flagged in red and
     the scan stops. Leftover opens at the end also mean "not balanced".
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Slot = { ch: string; i: number };
type Frame = {
  pos: number; // index of the char just processed (-1 = none yet)
  stack: Slot[];
  status: 'start' | 'push' | 'match' | 'skip' | 'error' | 'ok' | 'bad';
  caption: string;
};

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSE: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const COLORS = { push: '#10b981', match: '#0ea5e9', error: '#ef4444' };

export default function StkBracketMatcher() {
  const [text, setText] = useState('{ [ ( ) ] }');
  const [s, setS] = useState('{[()]}');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // Precompute the scan frame-by-frame, stopping at the first error.
  const frames: Frame[] = (() => {
    const out: Frame[] = [{ pos: -1, stack: [], status: 'start', caption: 'Nothing scanned yet. Opens get pushed; each close must match the current top.' }];
    const stack: Slot[] = [];
    let errored = false;
    for (let i = 0; i < s.length && !errored; i++) {
      const ch = s[i];
      if (ch in OPEN) {
        stack.push({ ch, i });
        out.push({ pos: i, stack: stack.map((x) => ({ ...x })), status: 'push', caption: `'${ch}' is an opening bracket → push it. Stack depth = ${stack.length}.` });
      } else if (ch in CLOSE) {
        if (stack.length === 0) {
          out.push({ pos: i, stack: [], status: 'error', caption: `'${ch}' tries to close, but the stack is empty — nothing to match. Not balanced.` });
          errored = true;
        } else if (stack[stack.length - 1].ch === CLOSE[ch]) {
          const m = stack.pop()!;
          out.push({ pos: i, stack: stack.map((x) => ({ ...x })), status: 'match', caption: `'${ch}' matches the '${m.ch}' on top → pop it. Stack depth = ${stack.length}.` });
        } else {
          out.push({ pos: i, stack: stack.map((x) => ({ ...x })), status: 'error', caption: `'${ch}' does not match the '${stack[stack.length - 1].ch}' on top — mismatch! Not balanced.` });
          errored = true;
        }
      } else {
        out.push({ pos: i, stack: stack.map((x) => ({ ...x })), status: 'skip', caption: `'${ch}' is not a bracket → ignore it.` });
      }
    }
    if (!errored) {
      const ok = stack.length === 0;
      out.push({ pos: s.length, stack: stack.map((x) => ({ ...x })), status: ok ? 'ok' : 'bad', caption: ok ? 'Reached the end with an empty stack — every bracket matched. Balanced! ✅' : `Reached the end but ${stack.length} bracket(s) are still open — not balanced.` });
    }
    return out;
  })();

  const last = frames.length - 1;
  const commit = () => { const cleaned = text.replace(/\s+/g, ''); setS(cleaned); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setIdx(last); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, s, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[Math.min(idx, last)];
  const isErr = frame.status === 'error' || frame.status === 'bad';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="e.g. { [ ( ) ] }" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* the string, one cell per character */}
      <div class="flex flex-wrap gap-1.5 font-mono text-base">
        {s.split('').map((ch, i) => {
          const active = i === frame.pos;
          const done = i < frame.pos;
          const color = frame.status === 'push' ? COLORS.push : frame.status === 'match' ? COLORS.match : isErr ? COLORS.error : COLORS.match;
          return (
            <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border font-bold transition ${active ? 'scale-110 border-transparent text-white' : done ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${color}` : ''}>{ch}</span>
          );
        })}
      </div>

      {/* the stack of open brackets */}
      <div class="mt-3 flex items-center gap-2 font-mono text-sm">
        <span class="w-12 shrink-0 font-bold text-muted">stack</span>
        <div class="flex min-h-[2.25rem] flex-wrap gap-1">
          {frame.stack.length === 0 ? (
            <span class="flex h-9 items-center rounded-md border border-dashed border-border px-3 text-muted">empty</span>
          ) : (
            frame.stack.map((slot, i) => (
              <div key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold ${i === frame.stack.length - 1 ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={i === frame.stack.length - 1 ? `background:${COLORS.push}` : ''}>{slot.ch}</div>
            ))
          )}
        </div>
      </div>

      <p class={`mt-3 min-h-[2.5rem] rounded-lg px-3 py-2 text-sm ${isErr ? 'bg-rose-500/15 font-semibold text-rose-600' : 'bg-surface-2 text-text'}`}>{frame.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try a mismatch like <span class="font-mono">( ] )</span> or an unclosed <span class="font-mono">( ( )</span> to see it fail. Spaces are ignored.</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated postfix (Reverse Polish) evaluator.
   - Edit a space-separated postfix expression, e.g. "2 3 + 4 *".
   - Numbers are PUSHED. An operator POPS the top two values, combines
     them, and PUSHES the result. No precedence or parentheses needed.
   - Each frame highlights the active token and the changed top cell.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Frame = {
  stack: number[];
  tokenIdx: number; // index of token just consumed (-1 = none)
  changed: number | null;
  caption: string;
  bad: boolean;
};

const COLORS = { push: '#10b981', op: '#0ea5e9', error: '#ef4444' };
const OPS = new Set(['+', '-', '*', '/']);
const isNum = (t: string) => /^-?\d+$/.test(t);

const apply = (a: number, b: number, op: string): number => {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  return Math.trunc(a / b);
};

export default function StkPostfixEval() {
  const [text, setText] = useState('2 3 + 4 *');
  const [tokens, setTokens] = useState<string[]>(() => '2 3 + 4 *'.trim().split(/\s+/));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames: Frame[] = (() => {
    const out: Frame[] = [{ stack: [], tokenIdx: -1, changed: null, caption: 'Empty stack. Scanning left to right: numbers are pushed, operators pop two and push their result.', bad: false }];
    const stack: number[] = [];
    let bad = false;
    for (let i = 0; i < tokens.length && !bad; i++) {
      const tok = tokens[i];
      if (isNum(tok)) {
        stack.push(parseInt(tok, 10));
        out.push({ stack: [...stack], tokenIdx: i, changed: stack.length - 1, caption: `'${tok}' is a number → push it. Stack height = ${stack.length}.`, bad: false });
      } else if (OPS.has(tok)) {
        if (stack.length < 2) {
          out.push({ stack: [...stack], tokenIdx: i, changed: null, caption: `Operator '${tok}' needs two operands but the stack has ${stack.length}. Malformed expression.`, bad: true });
          bad = true;
        } else {
          const b = stack.pop()!;
          const a = stack.pop()!;
          const r = apply(a, b, tok);
          stack.push(r);
          out.push({ stack: [...stack], tokenIdx: i, changed: stack.length - 1, caption: `'${tok}' pops ${b} then ${a}, computes ${a} ${tok} ${b} = ${r}, and pushes ${r}.`, bad: false });
        }
      } else {
        out.push({ stack: [...stack], tokenIdx: i, changed: null, caption: `'${tok}' is not a number or a +,-,*,/ operator. Skipping.`, bad: false });
      }
    }
    if (!bad) {
      const ok = stack.length === 1;
      out.push({ stack: [...stack], tokenIdx: tokens.length, changed: stack.length - 1, caption: ok ? `Done. One value remains: the result is ${stack[0]}.` : `Done, but ${stack.length} values remain — a well-formed postfix expression should leave exactly one.`, bad: !ok });
    }
    return out;
  })();

  const last = frames.length - 1;
  const commit = () => { const t = text.trim().split(/\s+/).filter(Boolean); setTokens(t); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 880 / speed;
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
  }, [playing, speed, tokens, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[Math.min(idx, last)];
  const hi = frame.bad ? COLORS.error : OPS.has(tokens[frame.tokenIdx]) ? COLORS.op : COLORS.push;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="e.g. 5 1 2 + 4 * + 3 -" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* tokens row */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {tokens.map((tok, i) => {
          const active = i === frame.tokenIdx;
          const done = i < frame.tokenIdx;
          return (
            <span key={i} class={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2 font-bold transition ${active ? 'scale-110 border-transparent text-white' : done ? 'border-border bg-surface-2 text-muted line-through' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${hi}` : ''}>{tok}</span>
          );
        })}
      </div>

      {/* the value stack, top-to-bottom */}
      <div class="mt-3 flex flex-col items-center gap-2 rounded-xl bg-surface-2 px-4 py-4">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted">top ↓</span>
        <div class="flex min-h-[2.75rem] w-28 flex-col-reverse gap-1">
          {frame.stack.length === 0 && <div class="rounded-md border border-dashed border-border px-3 py-2 text-center font-mono text-sm text-muted">empty</div>}
          {frame.stack.map((v, i) => {
            const isHi = i === frame.changed;
            return (
              <div key={i} class={`rounded-md border px-3 py-2 text-center font-mono text-sm font-bold transition ${isHi ? 'scale-105 border-transparent text-white' : 'border-border bg-surface text-text'}`} style={isHi ? `background:${hi}` : ''}>{v}</div>
            );
          })}
        </div>
      </div>

      <p class={`mt-3 min-h-[2.5rem] rounded-lg px-3 py-2 text-sm ${frame.bad ? 'bg-rose-500/15 font-semibold text-rose-600' : 'bg-surface-2 text-text'}`}>{frame.caption}</p>
      {idx >= last && !frame.bad && frame.stack.length === 1 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Result = {frame.stack[0]}. No parentheses, no precedence rules — the stack did all the bookkeeping.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Space-separated tokens only. Operators: + - * / (integer division). Try <span class="font-mono">5 1 2 + 4 * + 3 -</span>.</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated sorting visualizer.
   - Pick an algorithm (bubble, insertion, quicksort, mergesort).
   - Press Sort to animate the bars; the comparison counter ticks up
     so you can FEEL the difference between O(n^2) and O(n log n).
   - Shuffle for a fresh random array.
   ------------------------------------------------------------------ */

type Algo = 'bubble' | 'insertion' | 'quick' | 'merge';
type Frame = { arr: number[]; active: number[]; done: number[]; comps: number };

const COLORS = {
  bar: '#0ea5e9',
  active: '#4f46e5',
  done: '#10b981',
};

const N = 22;

function makeArray(): number[] {
  return Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
}

function snap(arr: number[], active: number[], done: number[], comps: number): Frame {
  return { arr: arr.slice(), active, done: done.slice(), comps };
}

function buildFrames(algo: Algo, input: number[]): Frame[] {
  const arr = input.slice();
  const frames: Frame[] = [];
  let comps = 0;
  const all = Array.from({ length: arr.length }, (_, k) => k);

  if (algo === 'bubble') {
    const done: number[] = [];
    for (let i = 0; i < arr.length - 1; i++) {
      for (let j = 0; j < arr.length - 1 - i; j++) {
        comps++;
        frames.push(snap(arr, [j, j + 1], done, comps));
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          frames.push(snap(arr, [j, j + 1], done, comps));
        }
      }
      done.push(arr.length - 1 - i);
    }
  } else if (algo === 'insertion') {
    for (let i = 1; i < arr.length; i++) {
      let j = i;
      while (j > 0) {
        comps++;
        frames.push(snap(arr, [j - 1, j], [], comps));
        if (arr[j - 1] > arr[j]) {
          [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
          j--;
        } else break;
      }
    }
  } else if (algo === 'quick') {
    const done: number[] = [];
    const qs = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) { done.push(lo); frames.push(snap(arr, [], done, comps)); return; }
      const pivot = arr[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        comps++;
        frames.push(snap(arr, [j, hi], done, comps));
        if (arr[j] < pivot) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          i++;
        }
      }
      [arr[i], arr[hi]] = [arr[hi], arr[i]];
      done.push(i);
      frames.push(snap(arr, [i], done, comps));
      qs(lo, i - 1);
      qs(i + 1, hi);
    };
    qs(0, arr.length - 1);
  } else {
    const ms = (lo: number, hi: number) => {
      if (hi - lo < 1) return;
      const mid = (lo + hi) >> 1;
      ms(lo, mid);
      ms(mid + 1, hi);
      const left = arr.slice(lo, mid + 1);
      const right = arr.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;
      while (i < left.length && j < right.length) {
        comps++;
        frames.push(snap(arr, [k], [], comps));
        if (left[i] <= right[j]) arr[k++] = left[i++];
        else arr[k++] = right[j++];
      }
      while (i < left.length) { arr[k++] = left[i++]; frames.push(snap(arr, [k - 1], [], comps)); }
      while (j < right.length) { arr[k++] = right[j++]; frames.push(snap(arr, [k - 1], [], comps)); }
    };
    ms(0, arr.length - 1);
  }

  frames.push(snap(arr, [], all, comps));
  return frames;
}

export default function SortingBarsVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const framesRef = useRef<Frame[]>([]);
  const idxRef = useRef(0);

  const [algo, setAlgo] = useState<Algo>('bubble');
  const [base, setBase] = useState<number[]>(makeArray);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<Frame>(() => snap(base, [], [], 0));

  const sizeRef = useRef({ w: 480, h: 260 });

  const draw = (f: Frame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 6;
    const barW = (w - pad * 2) / f.arr.length;
    const maxV = f.arr.length;
    const activeSet = new Set(f.active);
    const doneSet = new Set(f.done);
    for (let i = 0; i < f.arr.length; i++) {
      const v = f.arr[i];
      const bh = ((h - 16) * v) / maxV;
      const x = pad + i * barW;
      const y = h - bh;
      let color = COLORS.bar;
      if (doneSet.has(i)) color = COLORS.done;
      else if (activeSet.has(i)) color = COLORS.active;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y, barW - 2, bh);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const hgt = Math.round(w * 0.5);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hgt };
      draw(frame);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => draw(frame), [frame]);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
  };

  const reset = (newBase?: number[]) => {
    stop();
    const b = newBase ?? base;
    if (newBase) setBase(newBase);
    setFrame(snap(b, [], [], 0));
  };

  const sort = () => {
    stop();
    const frames = buildFrames(algo, base);
    framesRef.current = frames;
    idxRef.current = 0;
    setRunning(true);
    let last = performance.now();
    const interval = 24; // ms per frame
    const tick = (t: number) => {
      if (t - last >= interval) {
        last = t;
        const i = idxRef.current;
        if (i < frames.length) {
          setFrame(frames[i]);
          idxRef.current = i + 1;
        }
      }
      if (idxRef.current < frames.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setRunning(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const labels: Record<Algo, string> = {
    bubble: 'Bubble', insertion: 'Insertion', quick: 'Quicksort', merge: 'Mergesort',
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['bubble', 'insertion', 'quick', 'merge'] as Algo[]).map((a) => (
          <button
            key={a}
            onClick={() => { setAlgo(a); reset(); }}
            disabled={running}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
              algo === a ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {labels[a]}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={sort}
          disabled={running}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          ▶ Sort
        </button>
        <button
          onClick={() => reset(makeArray())}
          disabled={running}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-50"
        >
          ↻ Shuffle
        </button>
        <div class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
          <span class="text-muted">comparisons </span>
          <strong class="font-mono">{frame.comps}</strong>
        </div>
      </div>
      <p class="mt-2 text-xs text-muted">
        Same {N} bars every time you switch algorithms — compare the final comparison counts. The two O(n log n) sorts finish in far fewer comparisons than the O(n²) ones.
      </p>
    </div>
  );
}

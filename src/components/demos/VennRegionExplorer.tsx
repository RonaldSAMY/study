import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive two-set Venn diagram.
   - Click the four regions (A only, both, B only, outside) to toggle them.
   - Or pick a preset set expression (A∪B, A∩B, A∖B, complement, …).
   - A live readout shows which elements of the universe are selected.
   Theme: a streaming catalog where movies are tagged Action (A) / Comedy (B).
   ------------------------------------------------------------------ */

type RegionKey = 'aOnly' | 'both' | 'bOnly' | 'neither';
type Selected = Record<RegionKey, boolean>;
type Circle = { x: number; y: number; r: number };
type Rect = { x: number; y: number; w: number; h: number };

const COLORS = {
  a: '#4f46e5',
  b: '#0ea5e9',
  fill: 'rgba(16,185,129,0.42)',
  axis: 'rgba(128,128,128,0.55)',
};

// Fixed dataset: which movies fall in each region.
const ELEMENTS: Record<RegionKey, string[]> = {
  aOnly: ['Mad Max', 'John Wick', 'Heat'],
  both: ['Spy', 'Deadpool'],
  bOnly: ['Superbad', 'Booksmart'],
  neither: ['Titanic', 'Her', 'Up'],
};

const EMPTY: Selected = { aOnly: false, both: false, bOnly: false, neither: false };

const PRESETS: { id: string; label: string; sel: Selected }[] = [
  { id: 'union', label: 'A ∪ B', sel: { aOnly: true, both: true, bOnly: true, neither: false } },
  { id: 'inter', label: 'A ∩ B', sel: { aOnly: false, both: true, bOnly: false, neither: false } },
  { id: 'diffAB', label: 'A ∖ B', sel: { aOnly: true, both: false, bOnly: false, neither: false } },
  { id: 'diffBA', label: 'B ∖ A', sel: { aOnly: false, both: false, bOnly: true, neither: false } },
  { id: 'compA', label: 'Aᶜ', sel: { aOnly: false, both: false, bOnly: true, neither: true } },
  { id: 'symdiff', label: 'A △ B', sel: { aOnly: true, both: false, bOnly: true, neither: false } },
  { id: 'clear', label: 'clear', sel: { ...EMPTY } },
];

export default function VennRegionExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Selected>({ ...EMPTY, both: true });
  const geoRef = useRef<{ A: Circle; B: Circle; uni: Rect; w: number; h: number }>({
    A: { x: 150, y: 150, r: 80 },
    B: { x: 230, y: 150, r: 80 },
    uni: { x: 8, y: 28, w: 360, h: 240 },
    w: 380,
    h: 280,
  });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { A, B, uni, w, h } = geoRef.current;
    ctx.clearRect(0, 0, w, h);

    // highlight selected regions (neither first — it uses compositing)
    const order: RegionKey[] = ['neither', 'both', 'aOnly', 'bOnly'];
    order.forEach((key) => {
      if (selected[key]) fillRegion(ctx, key, COLORS.fill, uni, A, B);
    });

    // universe border + label
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(uni.x, uni.y, uni.w, uni.h);
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillStyle = COLORS.axis;
    ctx.fillText('U  (the universe)', uni.x + 6, uni.y - 8);

    // circle outlines
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.a;
    ctx.beginPath(); ctx.arc(A.x, A.y, A.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = COLORS.b;
    ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, Math.PI * 2); ctx.stroke();

    // set labels
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillStyle = COLORS.a;
    ctx.fillText('A', A.x - A.r + 10, A.y - A.r + 24);
    ctx.fillStyle = COLORS.b;
    ctx.fillText('B', B.x + B.r - 24, B.y - B.r + 24);

    // region counts
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(120,120,120,0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(`${ELEMENTS.aOnly.length}`, A.x - A.r * 0.55, A.y + 4);
    ctx.fillText(`${ELEMENTS.both.length}`, (A.x + B.x) / 2, A.y + 4);
    ctx.fillText(`${ELEMENTS.bOnly.length}`, B.x + B.r * 0.55, A.y + 4);
    ctx.fillText(`${ELEMENTS.neither.length}`, uni.x + 22, uni.y + uni.h - 14);
    ctx.textAlign = 'start';
  };

  // responsive sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const h = Math.round(w * 0.74);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = Math.min(w, h) * 0.27;
      const cy = h * 0.55;
      const A = { x: w * 0.42, y: cy, r };
      const B = { x: w * 0.58, y: cy, r };
      const uni = { x: 8, y: 26, w: w - 16, h: h - 36 };
      geoRef.current = { A, B, uni, w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [selected]);

  const onClick = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { A, B } = geoRef.current;
    const inA = Math.hypot(px - A.x, py - A.y) < A.r;
    const inB = Math.hypot(px - B.x, py - B.y) < B.r;
    const key: RegionKey = inA && inB ? 'both' : inA ? 'aOnly' : inB ? 'bOnly' : 'neither';
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const chosen: string[] = (['aOnly', 'both', 'bOnly', 'neither'] as RegionKey[])
    .filter((k) => selected[k])
    .flatMap((k) => ELEMENTS[k]);
  const total =
    ELEMENTS.aOnly.length + ELEMENTS.both.length + ELEMENTS.bOnly.length + ELEMENTS.neither.length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected({ ...p.sel })}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-brand-soft hover:text-brand"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none cursor-pointer rounded-xl bg-surface-2"
          onClick={onClick}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click a region to toggle it, or pick a set expression above. The numbers are how many
            movies live in each region.
          </p>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">selected elements</span>
              <strong>{chosen.length} / {total}</strong>
            </div>
            <p class="mt-1 font-mono text-[0.8rem] leading-relaxed text-text">
              {chosen.length ? '{ ' + chosen.join(', ') + ' }' : '∅  (empty set)'}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <span class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">A = Action:</span> {ELEMENTS.aOnly.length + ELEMENTS.both.length}
            </span>
            <span class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">B = Comedy:</span> {ELEMENTS.bOnly.length + ELEMENTS.both.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function arc(ctx: CanvasRenderingContext2D, c: Circle) {
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
}

function fillRegion(
  ctx: CanvasRenderingContext2D,
  key: RegionKey,
  col: string,
  uni: Rect,
  A: Circle,
  B: Circle,
) {
  ctx.save();
  ctx.fillStyle = col;
  if (key === 'both') {
    arc(ctx, A); ctx.clip();
    arc(ctx, B); ctx.clip();
    ctx.fillRect(uni.x, uni.y, uni.w, uni.h);
  } else if (key === 'aOnly') {
    arc(ctx, A); ctx.clip();
    ctx.beginPath();
    ctx.rect(uni.x, uni.y, uni.w, uni.h);
    ctx.arc(B.x, B.y, B.r, 0, Math.PI * 2);
    ctx.fill('evenodd');
  } else if (key === 'bOnly') {
    arc(ctx, B); ctx.clip();
    ctx.beginPath();
    ctx.rect(uni.x, uni.y, uni.w, uni.h);
    ctx.arc(A.x, A.y, A.r, 0, Math.PI * 2);
    ctx.fill('evenodd');
  } else {
    // neither: fill the universe, then erase both circles
    ctx.beginPath();
    ctx.rect(uni.x, uni.y, uni.w, uni.h);
    ctx.clip();
    ctx.fillRect(uni.x, uni.y, uni.w, uni.h);
    ctx.globalCompositeOperation = 'destination-out';
    arc(ctx, A); ctx.fill();
    arc(ctx, B); ctx.fill();
  }
  ctx.restore();
}

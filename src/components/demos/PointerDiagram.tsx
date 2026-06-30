import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive pointer diagram.
   - A column of named "variable boxes", each with an address + value.
   - One box is a pointer (p): its value is the ADDRESS of a target box.
   - An arrow is drawn from p to the box living at the address it holds.
   - Buttons (or clicking a target box) change which address p stores;
     the arrow follows. "Dereference *p" highlights the pointed-to value.
   - Arrow-head drawing reuses the technique from VectorPlayground.
   ------------------------------------------------------------------ */

type VarBox = { name: string; addr: number; value: number; pointable: boolean };

const COLORS = {
  box: 'rgba(128,128,128,0.10)',
  boxBorder: 'rgba(128,128,128,0.30)',
  pointer: '#4f46e5',
  arrow: '#0ea5e9',
  target: '#10b981',
  addr: 'rgba(120,120,120,0.95)',
};

const hex4 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');

// the three int variables p can point at, plus the pointer box itself
const DATA: VarBox[] = [
  { name: 'health', addr: 0x2000, value: 42, pointable: true },
  { name: 'ammo', addr: 0x2004, value: 7, pointable: true },
  { name: 'score', addr: 0x2008, value: 999, pointable: true },
];

export default function PointerDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // p holds the address of one of the DATA boxes (start: health)
  const [pTarget, setPTarget] = useState(0x2000);
  const [deref, setDeref] = useState(false);
  const layoutRef = useRef({ w: 480, h: 300, bx: 20, by: 16, bw: 200, bh: 56, gap: 12, px: 280, pw: 180 });

  const targetIndex = DATA.findIndex((d) => d.addr === pTarget);
  const targetVar = DATA[targetIndex];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, bx, by, bw, bh, gap, px, pw } = layoutRef.current;
    ctx.clearRect(0, 0, w, h);

    // ---- left column: the data variables ----
    DATA.forEach((d, i) => {
      const y = by + i * (bh + gap);
      const isTarget = d.addr === pTarget;
      drawBox(ctx, bx, y, bw, bh, isTarget && deref ? COLORS.target : COLORS.boxBorder, isTarget && deref);
      // address
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillStyle = COLORS.addr;
      ctx.textAlign = 'left';
      ctx.fillText(hex4(d.addr), bx + 10, y + 16);
      // name
      ctx.font = '700 14px Inter, sans-serif';
      ctx.fillStyle = isTarget && deref ? COLORS.target : '#374151';
      ctx.fillText(d.name, bx + 10, y + 36);
      // value (right aligned)
      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = isTarget && deref ? COLORS.target : COLORS.pointer;
      ctx.textAlign = 'right';
      ctx.fillText(String(d.value), bx + bw - 12, y + 38);
      ctx.textAlign = 'left';
    });

    // ---- right side: the pointer box ----
    const pY = by + 1 * (bh + gap); // vertically centered-ish
    drawBox(ctx, px, pY, pw, bh, COLORS.pointer, true);
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillStyle = COLORS.addr;
    ctx.fillText(hex4(0x3000), px + 10, pY + 16);
    ctx.font = '700 14px Inter, sans-serif';
    ctx.fillStyle = COLORS.pointer;
    ctx.fillText('p  (int *)', px + 10, pY + 36);
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.pointer;
    ctx.fillText(hex4(pTarget), px + pw - 12, pY + 38);
    ctx.textAlign = 'left';

    // ---- arrow from pointer box to the target box ----
    if (targetIndex >= 0) {
      const ty = by + targetIndex * (bh + gap);
      const from = { x: px, y: pY + bh / 2 };
      const to = { x: bx + bw + 6, y: ty + bh / 2 };
      // a little elbow so it reads as "follow the address"
      arrow(ctx, from, to, COLORS.arrow, 2.5);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const narrow = w < 440;
      const bw = narrow ? Math.min(180, w * 0.5) : 200;
      const pw = narrow ? Math.min(150, w * 0.42) : 180;
      const bx = 16;
      const px = w - pw - 16;
      const bh = 56;
      const gap = 14;
      const by = 16;
      const h = by * 2 + DATA.length * (bh + gap) - gap;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = { w, h, bx, by, bw, bh, gap, px, pw };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [pTarget, deref]);

  // ---- click a left-column box to point p at it ----
  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { bx, by, bw, bh, gap } = layoutRef.current;
    DATA.forEach((d, i) => {
      const y = by + i * (bh + gap);
      if (px >= bx && px <= bx + bw && py >= y && py <= y + bh) {
        setPTarget(d.addr);
        e.preventDefault();
      }
    });
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
      />

      <p class="mt-3 text-sm text-muted">
        Click a variable on the left to make <span class="font-mono font-semibold">p</span> point at it,
        then press <span class="font-semibold">Dereference</span> to follow the arrow.
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        {DATA.map((d) => (
          <button
            key={d.addr}
            onClick={() => setPTarget(d.addr)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              pTarget === d.addr ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            p = &amp;{d.name}
          </button>
        ))}
        <button
          onClick={() => setDeref((v) => !v)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            deref ? 'bg-[#10b981] text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {deref ? 'Hide *p' : 'Dereference *p'}
        </button>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2">
        <Readout label="p holds" value={hex4(pTarget)} color={COLORS.pointer} />
        <Readout label="points at" value={targetVar ? targetVar.name : '—'} color={COLORS.arrow} />
        <Readout label="*p evaluates to" value={targetVar ? String(targetVar.value) : '—'} color={COLORS.target} />
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

// ---- canvas primitives ----
function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  border: string,
  emphasize: boolean,
) {
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = emphasize ? 'rgba(16,185,129,0.10)' : COLORS.box;
  ctx.fill();
  ctx.lineWidth = emphasize ? 2.5 : 1.5;
  ctx.strokeStyle = border;
  ctx.stroke();
}

function arrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width: number,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

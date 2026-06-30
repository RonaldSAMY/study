import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Walk ONE triangle through the rendering pipeline, stage by stage.
   - "Next stage" / "Prev stage" buttons (or tap the canvas) advance.
   - Each stage redraws the triangle's representation: raw vertices,
     transformed triangle, clipping, rasterized pixels, shaded
     fragments, and the final framebuffer.
   - Crisp, responsive, touch-friendly canvas.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const COLORS = {
  v0: '#4f46e5',
  v1: '#0ea5e9',
  v2: '#10b981',
  edge: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
  faint: 'rgba(128,128,128,0.45)',
};

const STAGES = [
  {
    name: '1 · Vertex input',
    sub: 'Raw vertices in model space',
    text: 'The GPU receives three vertices — just positions (and extras like color). No triangle yet, only points and the data attached to each.',
  },
  {
    name: '2 · Vertex transform',
    sub: 'Model → World → View → Clip',
    text: 'The vertex shader multiplies each position by the Model-View-Projection matrix, moving it through coordinate spaces into clip space.',
  },
  {
    name: '3 · Clipping',
    sub: 'Trim to the view volume',
    text: 'Parts of the triangle outside the visible box are clipped away, so only what the camera can actually see continues down the pipeline.',
  },
  {
    name: '4 · Rasterization',
    sub: 'Triangle → fragments',
    text: 'The triangle is sampled against a pixel grid. Every cell whose center falls inside becomes a fragment — a candidate pixel.',
  },
  {
    name: '5 · Fragment shading',
    sub: 'Color each fragment',
    text: 'The fragment shader runs once per covered pixel, computing a color by interpolating the vertex data across the triangle.',
  },
  {
    name: '6 · Output',
    sub: 'Write to the framebuffer',
    text: 'Surviving fragments are written to the framebuffer (after depth tests). That buffer is the image you finally see on screen.',
  },
];

export default function PipelineStageWalkthrough() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  const sizeRef = useRef({ w: 520, h: 360 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const m = 28;
    const drawW = w - m * 2;
    const drawH = h - m * 2;

    // Triangle in [0,1] space (used from stage 2 onward, "transformed").
    const triN: Pt[] = [
      { x: 0.20, y: 0.78 },
      { x: 0.86, y: 0.62 },
      { x: 0.50, y: 0.12 },
    ];
    // Raw vertices before transform (offset/rotated to look "untransformed").
    const rawN: Pt[] = [
      { x: 0.34, y: 0.66 },
      { x: 0.74, y: 0.74 },
      { x: 0.58, y: 0.30 },
    ];
    const map = (p: Pt): Pt => ({ x: m + p.x * drawW, y: m + p.y * drawH });
    const tri = triN.map(map);
    const raw = rawN.map(map);

    const vcolors = [COLORS.v0, COLORS.v1, COLORS.v2];

    if (stage === 0) {
      // raw vertices only
      drawDottedBox(ctx, m, m, drawW, drawH, COLORS.grid);
      raw.forEach((p, i) => {
        dot(ctx, p, vcolors[i], 8);
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillStyle = vcolors[i];
        ctx.fillText(`v${i}`, p.x + 12, p.y - 10);
      });
      return;
    }

    if (stage === 1) {
      // transform: faint raw + arrows to transformed triangle
      drawDottedBox(ctx, m, m, drawW, drawH, COLORS.grid);
      raw.forEach((p) => dot(ctx, p, COLORS.faint, 5));
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.faint;
      ctx.lineWidth = 1.5;
      raw.forEach((p, i) => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tri[i].x, tri[i].y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      strokeTriangle(ctx, tri, COLORS.edge, 2.5);
      tri.forEach((p, i) => dot(ctx, p, vcolors[i], 7));
      return;
    }

    if (stage === 2) {
      // clipping: clip rectangle, triangle, region outside greyed
      const cx = m + drawW * 0.07;
      const cy = m + drawH * 0.05;
      const cw = drawW * 0.86;
      const ch = drawH * 0.9;
      // fill triangle faint
      fillTriangle(ctx, tri, 'rgba(79,70,229,0.12)');
      strokeTriangle(ctx, tri, COLORS.edge, 2.5);
      // clip box
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = COLORS.v2;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.setLineDash([]);
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = COLORS.v2;
      ctx.fillText('view volume', cx + 6, cy + 16);
      tri.forEach((p, i) => dot(ctx, p, vcolors[i], 6));
      return;
    }

    // Stages 3-5 use a coarse pixel grid.
    const cols = 18;
    const cell = drawW / cols;
    const rows = Math.floor(drawH / cell);
    const gridW = cols * cell;
    const gridH = rows * cell;
    const gx0 = m;
    const gy0 = m;

    const inside = (cxp: number, cyp: number) => {
      const e0 = edge(tri[0], tri[1], { x: cxp, y: cyp });
      const e1 = edge(tri[1], tri[2], { x: cxp, y: cyp });
      const e2 = edge(tri[2], tri[0], { x: cxp, y: cyp });
      return (e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0);
    };

    if (stage === 3 || stage === 4) {
      // grid lines
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(gx0 + c * cell, gy0);
        ctx.lineTo(gx0 + c * cell, gy0 + gridH);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(gx0, gy0 + r * cell);
        ctx.lineTo(gx0 + gridW, gy0 + r * cell);
        ctx.stroke();
      }
    }

    if (stage === 3 || stage === 4) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ccx = gx0 + (c + 0.5) * cell;
          const ccy = gy0 + (r + 0.5) * cell;
          if (!inside(ccx, ccy)) continue;
          if (stage === 3) {
            ctx.fillStyle = 'rgba(79,70,229,0.55)';
          } else {
            const bc = bary(tri[0], tri[1], tri[2], { x: ccx, y: ccy });
            ctx.fillStyle = mixColor(bc);
          }
          ctx.fillRect(gx0 + c * cell + 0.5, gy0 + r * cell + 0.5, cell - 1, cell - 1);
        }
      }
      strokeTriangle(ctx, tri, stage === 3 ? COLORS.edge : 'rgba(80,80,80,0.5)', stage === 3 ? 2 : 1.5);
      if (stage === 4) tri.forEach((p, i) => dot(ctx, p, vcolors[i], 6));
      return;
    }

    // stage 5: final framebuffer — just the shaded blocks, no grid, no outline
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ccx = gx0 + (c + 0.5) * cell;
        const ccy = gy0 + (r + 0.5) * cell;
        if (!inside(ccx, ccy)) continue;
        const bc = bary(tri[0], tri[1], tri[2], { x: ccx, y: ccy });
        ctx.fillStyle = mixColor(bc);
        ctx.fillRect(gx0 + c * cell, gy0 + r * cell, cell, cell);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.7);
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
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [stage]);

  const next = () => setStage((s) => Math.min(STAGES.length - 1, s + 1));
  const prev = () => setStage((s) => Math.max(0, s - 1));

  const cur = STAGES[stage];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={prev}
          disabled={stage === 0}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40"
        >
          ‹ Prev stage
        </button>
        <button
          onClick={next}
          disabled={stage === STAGES.length - 1}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-40"
        >
          Next stage ›
        </button>
        <span class="ml-auto text-xs text-muted">
          Stage {stage + 1} / {STAGES.length}
        </span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={next}
          title="Tap to advance"
        />

        <div class="space-y-3 text-sm">
          <div class="rounded-lg bg-brand-soft p-3">
            <div class="font-semibold text-text">{cur.name}</div>
            <div class="text-xs text-muted">{cur.sub}</div>
          </div>
          <p class="text-muted">{cur.text}</p>

          <div class="flex flex-wrap gap-1.5">
            {STAGES.map((st, i) => (
              <button
                key={st.name}
                onClick={() => setStage(i)}
                class={`h-2.5 w-6 rounded-full transition ${
                  i === stage ? 'bg-brand' : 'bg-surface-2 hover:bg-border'
                }`}
                title={st.name}
              />
            ))}
          </div>
          <p class="text-xs text-muted">Tap the canvas or a dot to step through.</p>
        </div>
      </div>
    </div>
  );
}

// ---- math helpers ----
function edge(a: Pt, b: Pt, p: Pt) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function bary(a: Pt, b: Pt, c: Pt, p: Pt) {
  const area = edge(a, b, c);
  if (area === 0) return { w0: 1 / 3, w1: 1 / 3, w2: 1 / 3 };
  const w0 = edge(b, c, p) / area;
  const w1 = edge(c, a, p) / area;
  const w2 = edge(a, b, p) / area;
  return { w0, w1, w2 };
}
function mixColor(bc: { w0: number; w1: number; w2: number }) {
  // v0 indigo, v1 sky, v2 emerald
  const cols = [
    [79, 70, 229],
    [14, 165, 233],
    [16, 185, 129],
  ];
  const r = cols[0][0] * bc.w0 + cols[1][0] * bc.w1 + cols[2][0] * bc.w2;
  const g = cols[0][1] * bc.w0 + cols[1][1] * bc.w1 + cols[2][1] * bc.w2;
  const b = cols[0][2] * bc.w0 + cols[1][2] * bc.w1 + cols[2][2] * bc.w2;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ---- drawing primitives ----
function dot(ctx: CanvasRenderingContext2D, p: Pt, color: string, rad: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}
function strokeTriangle(ctx: CanvasRenderingContext2D, t: Pt[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(t[0].x, t[0].y);
  ctx.lineTo(t[1].x, t[1].y);
  ctx.lineTo(t[2].x, t[2].y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function fillTriangle(ctx: CanvasRenderingContext2D, t: Pt[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(t[0].x, t[0].y);
  ctx.lineTo(t[1].x, t[1].y);
  ctx.lineTo(t[2].x, t[2].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function drawDottedBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

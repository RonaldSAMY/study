import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Right-triangle ratio explorer (SOH-CAH-TOA).
   - Drag the apex to reshape a right triangle.
   - The right angle sits at the bottom-right; the angle θ is at the
     bottom-left vertex.
   - Live readout of opposite / adjacent / hypotenuse and the three
     ratios sin θ, cos θ, tan θ.
   ------------------------------------------------------------------ */

const COLORS = {
  opp: '#10b981',   // emerald  (opposite)
  adj: '#0ea5e9',   // sky      (adjacent)
  hyp: '#4f46e5',   // indigo   (hypotenuse)
  grid: 'rgba(128,128,128,0.18)',
};

export default function RightTriangleRatios() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // adjacent (horizontal) and opposite (vertical) leg lengths, in "units"
  const [adj, setAdj] = useState(4);
  const [opp, setOpp] = useState(3);
  const draggingRef = useRef(false);
  // scale = px per unit; A is the bottom-left vertex in px
  const sizeRef = useRef({ w: 460, h: 360, scale: 48, ax: 60, ay: 300 });

  const toPx = (ux: number, uy: number) => {
    const { scale, ax, ay } = sizeRef.current;
    return { x: ax + ux * scale, y: ay - uy * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const A = toPx(0, 0);          // angle θ here
    const B = toPx(adj, 0);        // right angle here
    const C = toPx(adj, opp);      // draggable apex

    // filled triangle
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
    ctx.fillStyle = 'rgba(79,70,229,0.08)';
    ctx.fill();

    // legs + hypotenuse
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.adj;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.strokeStyle = COLORS.opp;
    ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.stroke();
    ctx.strokeStyle = COLORS.hyp;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.stroke();

    // right-angle square at B
    const sq = 12;
    const sgnx = adj >= 0 ? -1 : 1;
    const sgny = opp >= 0 ? -1 : 1;
    ctx.strokeStyle = 'rgba(128,128,128,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(B.x + (sgnx < 0 ? -sq : 0), B.y + (sgny < 0 ? -sq : 0), sq, sq);

    // angle θ arc at A
    const theta = Math.atan2(opp, adj);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(A.x, A.y, 28, 0, -theta, true); ctx.stroke();

    // labels
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = COLORS.adj;
    ctx.fillText('adjacent', (A.x + B.x) / 2 - 24, A.y + 18);
    ctx.fillStyle = COLORS.opp;
    ctx.fillText('opposite', B.x + 8, (B.y + C.y) / 2);
    ctx.fillStyle = COLORS.hyp;
    ctx.fillText('hyp', (A.x + C.x) / 2 - 30, (A.y + C.y) / 2 - 8);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('θ', A.x + 34, A.y - 6);

    // draggable handle at apex C
    ctx.beginPath(); ctx.arc(C.x, C.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.hyp; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(34, Math.min(56, w / 8));
      sizeRef.current = { w, h, scale, ax: w * 0.13, ay: h * 0.85 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [adj, opp]);

  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const C = toPx(adj, opp);
    const d = Math.hypot(e.clientX - rect.left - C.x, e.clientY - rect.top - C.y);
    if (d < 26) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { scale, ax, ay } = sizeRef.current;
    const ux = (e.clientX - rect.left - ax) / scale;
    const uy = (ay - (e.clientY - rect.top)) / scale;
    setAdj(Math.max(0.5, Math.min(7, Math.round(ux * 2) / 2)));
    setOpp(Math.max(0.5, Math.min(5.5, Math.round(uy * 2) / 2)));
  };
  const onUp = () => { draggingRef.current = false; };

  const hyp = Math.hypot(adj, opp);
  const theta = (Math.atan2(opp, adj) * 180) / Math.PI;
  const sin = opp / hyp;
  const cos = adj / hyp;
  const tan = opp / adj;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the apex to reshape the triangle. θ is the angle at the bottom-left corner.</p>

          <div class="grid grid-cols-3 gap-2">
            <Readout label="opposite" color={COLORS.opp} value={opp.toFixed(1)} />
            <Readout label="adjacent" color={COLORS.adj} value={adj.toFixed(1)} />
            <Readout label="hyp" color={COLORS.hyp} value={hyp.toFixed(2)} />
          </div>

          <Readout label="angle θ" value={`${theta.toFixed(1)}°`} />

          <div class="space-y-2 rounded-lg bg-surface-2 p-3 font-mono text-[0.8rem]">
            <Row k="sin θ = opp / hyp" v={`${opp.toFixed(1)} / ${hyp.toFixed(2)} = ${sin.toFixed(3)}`} c={COLORS.opp} />
            <Row k="cos θ = adj / hyp" v={`${adj.toFixed(1)} / ${hyp.toFixed(2)} = ${cos.toFixed(3)}`} c={COLORS.adj} />
            <Row k="tan θ = opp / adj" v={`${opp.toFixed(1)} / ${adj.toFixed(1)} = ${tan.toFixed(3)}`} c={COLORS.hyp} />
          </div>
          <p class="text-xs text-muted">
            Reshape the triangle but keep θ fixed and the three ratios never change — that is what makes them functions of the <em>angle</em> alone.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
function Row({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div class="flex flex-wrap justify-between gap-2">
      <span style={`color:${c}`}>{k}</span><strong>{v}</strong>
    </div>
  );
}

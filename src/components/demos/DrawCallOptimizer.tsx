import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Draw-call / frame-time optimizer.
   - A scene of many objects, each costing CPU time to submit & draw.
   - Toggle classic optimizations and watch the modelled frame time
     fall (and the culled objects dim out on the canvas):
       * Frustum culling  - skip what the camera can't see
       * Batching         - merge same-material objects into one call
       * Instancing       - one call draws every copy of a mesh
       * LOD              - distant objects use cheaper meshes
   ------------------------------------------------------------------ */

const TOTAL = 1600;
const MESH_TYPES = 6; // distinct meshes/materials in the scene
const BUDGET = 1000 / 60;

type Opt = { key: string; label: string; on: boolean };

// deterministic scene so toggles compare fairly
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Obj = { x: number; y: number; mesh: number; far: boolean; visible: boolean };

function buildScene(): Obj[] {
  const rng = mulberry32(99);
  const objs: Obj[] = [];
  for (let i = 0; i < TOTAL; i++) {
    objs.push({
      x: rng(), y: rng(),
      mesh: Math.floor(rng() * MESH_TYPES),
      far: rng() > 0.5,
      visible: true,
    });
  }
  return objs;
}

export default function DrawCallOptimizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360 });
  const sceneRef = useRef<Obj[]>(buildScene());

  const [opts, setOpts] = useState<Opt[]>([
    { key: 'cull', label: 'Frustum culling', on: false },
    { key: 'batch', label: 'Batching', on: false },
    { key: 'instance', label: 'Instancing', on: false },
    { key: 'lod', label: 'Level of detail (LOD)', on: false },
  ]);

  const is = (k: string) => opts.find((o) => o.key === k)!.on;

  // ---- model the cost ----
  const scene = sceneRef.current;
  // camera frustum covers ~45% of the scene (left portion)
  const visibleObjs = is('cull') ? scene.filter((o) => o.x < 0.45) : scene;
  const visibleCount = visibleObjs.length;

  // draw calls
  let drawCalls: number;
  if (is('instance')) drawCalls = MESH_TYPES;          // one call per mesh type
  else if (is('batch')) drawCalls = Math.ceil(visibleCount / 50); // merged groups
  else drawCalls = visibleCount;                        // naive: one per object

  // per-object vertex/shading work, reduced by LOD on far objects
  const perObjFar = is('lod') ? 0.0009 : 0.0028;
  const perObjNear = 0.0028;
  let shadeMs = 0;
  for (const o of visibleObjs) shadeMs += o.far ? perObjFar : perObjNear;

  const CALL_OVERHEAD = 0.0065; // CPU cost to submit one draw call (ms)
  const frameMs = 0.8 + drawCalls * CALL_OVERHEAD + shadeMs; // 0.8 = fixed overhead
  const fps = Math.min(60, Math.round(1000 / frameMs));
  const over = frameMs > BUDGET;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    ctx.clearRect(0, 0, w, w);
    const culling = is('cull');
    const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    for (const o of scene) {
      const culled = culling && o.x >= 0.45;
      ctx.globalAlpha = culled ? 0.08 : 1;
      ctx.fillStyle = palette[o.mesh];
      const r = o.far && is('lod') ? 1.6 : 2.6;
      ctx.beginPath();
      ctx.arc(o.x * w, o.y * w, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // frustum boundary
    if (culling) {
      ctx.strokeStyle = 'rgba(128,128,128,0.6)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0.45 * w, 0); ctx.lineTo(0.45 * w, w); ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [opts]);

  const toggle = (key: string) =>
    setOpts((prev) => prev.map((o) => (o.key === key ? { ...o, on: !o.on } : o)));

  const scaleMax = Math.max(BUDGET * 1.6, frameMs * 1.05);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          {/* frame-time bar */}
          <div class="relative h-7 w-full overflow-hidden rounded-lg bg-surface-2">
            <div
              class="h-full transition-all"
              style={`width:${Math.min(100, (frameMs / scaleMax) * 100)}%;background:${over ? '#ef4444' : '#10b981'}`}
            />
            <div class="absolute top-0 h-full border-l-2 border-dashed border-text/70"
              style={`left:${(BUDGET / scaleMax) * 100}%`} />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <Readout label="frame time" value={`${frameMs.toFixed(2)} ms`} bad={over} />
            <Readout label="FPS" value={String(fps)} bad={over} />
            <Readout label="draw calls" value={drawCalls.toLocaleString()} />
          </div>
          <Readout label="objects drawn" value={`${visibleCount.toLocaleString()} / ${TOTAL.toLocaleString()}`} />

          <div class="space-y-1.5">
            {opts.map((o) => (
              <button
                key={o.key}
                onClick={() => toggle(o.key)}
                class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                  o.on ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                <span class="font-semibold">{o.label}</span>
                <span class="text-xs">{o.on ? 'ON' : 'off'}</span>
              </button>
            ))}
          </div>
          <p class="text-xs text-muted">
            Toggle optimizations and watch the bar shrink under the budget line. Each technique attacks
            a different cost: fewer calls, fewer objects, or cheaper objects.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div class={`rounded-lg px-3 py-2 ${bad ? 'bg-geometry/10' : 'bg-surface-2'}`}>
      <span class="text-muted">{label}</span>
      <div class={`font-mono font-semibold ${bad ? 'text-geometry' : ''}`}>{value}</div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated LSM-tree write + read path.
   - Edit the stream of keys to write and a key to read, then Load.
   - The demo streams each put() into the in-memory MEMTABLE (kept
     sorted). When the memtable fills, it FLUSHES to a sorted SSTable
     on disk in Level 0. When Level 0 collects enough SSTables, a
     background COMPACTION merges them into one sorted run in Level 1.
   - The read path then probes the memtable first, then Level 0
     (newest SSTable first), then Level 1 — highlighting each box.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const MEM_CAP = 4;      // memtable flushes once it holds this many keys
const L0_COMPACT = 3;   // Level 0 compacts once it holds this many SSTables

const COLORS = {
  write: '#0ea5e9',   // sky  — key just written
  disk: '#10b981',    // emerald — flush / compaction
  probe: '#4f46e5',   // indigo — read probe
  found: '#10b981',
};

type Probe = { where: 'mem' | 'l0' | 'l1'; idx?: number };
type Frame = {
  mem: number[];
  levels: number[][][];           // levels[l] = SSTables; each SSTable = sorted keys
  caption: string;
  active: 'idle' | 'write' | 'flush' | 'compact' | 'read';
  flashKey?: number;
  flashSST?: { level: number; idx: number };
  probe?: Probe;
  found?: 'mem' | 'l0' | 'l1' | 'none' | null;
  readKey?: number;
};

const parseKeys = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x) && x >= 0 && x < 100);

function mergeUnique(ssts: number[][]): number[] {
  const set = new Set<number>();
  for (const s of ssts) for (const k of s) set.add(k);
  return [...set].sort((a, b) => a - b);
}

function genFrames(keys: number[], readKey: number): Frame[] {
  const frames: Frame[] = [];
  let mem: number[] = [];
  let levels: number[][][] = [[], []];
  const snap = (caption: string, active: Frame['active'], extra: Partial<Frame> = {}) => {
    frames.push({ mem: mem.slice(), levels: levels.map((l) => l.map((s) => s.slice())), caption, active, ...extra });
  };

  snap('Empty store. Press Play to stream writes into the in-memory memtable.', 'idle');

  for (const k of keys) {
    mem = mem.filter((x) => x !== k);
    mem.push(k);
    mem.sort((a, b) => a - b);
    snap(`put(${k}) → buffered in the memtable (a sorted in-RAM tree). No disk write yet.`, 'write', { flashKey: k });

    if (mem.length >= MEM_CAP) {
      levels[0].push(mem.slice());
      mem = [];
      snap(`Memtable hit ${MEM_CAP} keys → FLUSH it to disk as one immutable sorted SSTable in Level 0.`, 'flush', {
        flashSST: { level: 0, idx: levels[0].length - 1 },
      });

      if (levels[0].length >= L0_COMPACT) {
        const merged = mergeUnique([...levels[0], ...levels[1]]);
        levels = [[], [merged]];
        snap(`Level 0 reached ${L0_COMPACT} SSTables → background COMPACTION merges them into one sorted run in Level 1.`, 'compact', {
          flashSST: { level: 1, idx: 0 },
        });
      }
    }
  }

  // ---- read path ----
  snap(`Now read get(${readKey}). Always check the memtable first — it holds the newest writes.`, 'read', {
    readKey, probe: { where: 'mem' }, found: null,
  });

  if (mem.includes(readKey)) {
    snap(`Found ${readKey} in the memtable — done, zero disk reads.`, 'read', { readKey, probe: { where: 'mem' }, found: 'mem' });
    return frames;
  }

  for (let i = levels[0].length - 1; i >= 0; i--) {
    const hit = levels[0][i].includes(readKey);
    snap(`Not in memtable. Probe Level 0 SSTable #${i} (newest first)…`, 'read', {
      readKey, probe: { where: 'l0', idx: i }, found: hit ? 'l0' : null,
    });
    if (hit) {
      snap(`Found ${readKey} in a Level 0 SSTable. Stop — newer levels win.`, 'read', { readKey, probe: { where: 'l0', idx: i }, found: 'l0' });
      return frames;
    }
  }

  for (let i = 0; i < levels[1].length; i++) {
    const hit = levels[1][i].includes(readKey);
    snap(`Probe Level 1 — one big sorted run, found by binary search inside it…`, 'read', {
      readKey, probe: { where: 'l1', idx: i }, found: hit ? 'l1' : null,
    });
    if (hit) {
      snap(`Found ${readKey} in Level 1. The read touched the memtable plus a few SSTables.`, 'read', { readKey, probe: { where: 'l1', idx: i }, found: 'l1' });
      return frames;
    }
  }

  snap(`${readKey} is in no level — it was never written. A Bloom filter would skip these disk probes.`, 'read', { readKey, found: 'none' });
  return frames;
}

export default function ModLsmTreeFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 340 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [keysText, setKeysText] = useState('42, 17, 88, 23, 9, 55, 31, 70, 4, 61, 12, 96');
  const [readText, setReadText] = useState('55');
  const [keys, setKeys] = useState<number[]>(() => parseKeys('42, 17, 88, 23, 9, 55, 31, 70, 4, 61, 12, 96'));
  const [readKey, setReadKey] = useState(55);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);

  const frames = useMemo(() => genFrames(keys, readKey), [keys, readKey]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const ks = parseKeys(keysText);
    const rk = parseInt(readText.trim(), 10);
    if (ks.length) { setKeys(ks); setReadKey(Number.isFinite(rk) ? rk : ks[0]); setIdx(0); setPlaying(false); }
  };

  // ---- autoplay ----
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  // ---- canvas sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 340;
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
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- redraw on frame change ----
  useEffect(draw, [idx, frames]);

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const css = (name: string, fallback: string) => {
      const v = getComputedStyle(canvas).getPropertyValue(name).trim();
      return v || fallback;
    };
    const muted = css('--color-muted', '#64748b');
    const textCol = css('--color-text', '#0f172a');
    const surface2 = css('--color-surface-2', '#f1f5f9');
    const border = css('--color-border', '#e2e8f0');

    const cellW = 30, cellH = 26, gap = 6;
    const drawKeyCells = (keysArr: number[], x: number, y: number, fill: string | null, txt: string) => {
      let cx = x;
      for (const k of keysArr) {
        ctx.fillStyle = fill || surface2;
        roundRect(ctx, cx, y, cellW, cellH, 5); ctx.fill();
        ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = txt;
        ctx.font = '600 12px ui-monospace, monospace';
        ctx.fillText(String(k), cx + cellW / 2, y + cellH / 2 + 1);
        cx += cellW + 4;
      }
      return cx;
    };

    const label = (s: string, x: number, y: number, col: string) => {
      ctx.fillStyle = col; ctx.font = '700 11px ui-sans-serif, system-ui'; ctx.textAlign = 'left';
      ctx.fillText(s, x, y); ctx.textAlign = 'center';
    };

    // ---- MEMTABLE band ----
    const memY = 24;
    const memActive = f.active === 'write' || (f.active === 'read' && f.probe?.where === 'mem');
    const memFound = f.found === 'mem';
    label('MEMTABLE  (in RAM, sorted)', 12, memY - 8, muted);
    const memBoxW = w - 24;
    ctx.fillStyle = surface2; roundRect(ctx, 12, memY, memBoxW, cellH + 16, 8); ctx.fill();
    ctx.lineWidth = memActive ? 2.5 : 1;
    ctx.strokeStyle = memFound ? COLORS.found : memActive ? COLORS.probe : border;
    ctx.stroke();
    let mx = 20;
    for (const k of f.mem) {
      const hot = f.flashKey === k && f.active === 'write';
      ctx.fillStyle = hot ? COLORS.write : '#ffffff';
      roundRect(ctx, mx, memY + 8, cellW, cellH, 5); ctx.fill();
      ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = hot ? '#ffffff' : textCol; ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(String(k), mx + cellW / 2, memY + 8 + cellH / 2 + 1);
      mx += cellW + 6;
    }
    if (f.mem.length === 0) { ctx.fillStyle = muted; ctx.font = '11px ui-sans-serif, system-ui'; ctx.fillText('(empty — flushed to disk)', 12 + memBoxW / 2, memY + 8 + cellH / 2); }

    // arrow
    ctx.strokeStyle = muted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w / 2, memY + cellH + 18); ctx.lineTo(w / 2, memY + cellH + 30); ctx.stroke();
    ctx.fillStyle = muted; ctx.font = '10px ui-sans-serif, system-ui'; ctx.fillText('flush ▼', w / 2 + 28, memY + cellH + 24);

    // ---- LEVEL bands ----
    const drawLevel = (lvl: number, y: number) => {
      label(`LEVEL ${lvl}  (on disk, immutable SSTables)`, 12, y - 6, muted);
      const ssts = f.levels[lvl];
      if (ssts.length === 0) {
        ctx.fillStyle = muted; ctx.font = 'italic 11px ui-sans-serif, system-ui'; ctx.textAlign = 'left';
        ctx.fillText('—', 14, y + 22); ctx.textAlign = 'center';
        return;
      }
      let bx = 12;
      ssts.forEach((sst, i) => {
        const boxW = sst.length * (cellW + 4) + 12;
        const isFlash = f.flashSST && f.flashSST.level === lvl && f.flashSST.idx === i;
        const isProbe = f.active === 'read' && f.probe && ((lvl === 0 && f.probe.where === 'l0' && f.probe.idx === i) || (lvl === 1 && f.probe.where === 'l1' && f.probe.idx === i));
        const isFound = isProbe && (f.found === 'l0' || f.found === 'l1');
        if (bx + boxW > w - 12) { bx = 12; y += cellH + 26; }
        ctx.fillStyle = surface2; roundRect(ctx, bx, y, boxW, cellH + 14, 7); ctx.fill();
        ctx.lineWidth = (isFlash || isProbe) ? 2.5 : 1;
        ctx.strokeStyle = isFound ? COLORS.found : isProbe ? COLORS.probe : isFlash ? COLORS.disk : border;
        ctx.stroke();
        drawKeyCells(sst, bx + 6, y + 7, '#ffffff', textCol);
        bx += boxW + 12;
      });
    };
    drawLevel(0, memY + cellH + 52);
    drawLevel(1, memY + cellH + 52 + cellH + 56);

    // read-key badge
    if (f.active === 'read' && f.readKey != null) {
      ctx.fillStyle = f.found === 'none' ? '#ef4444' : COLORS.probe;
      ctx.font = '700 12px ui-sans-serif, system-ui'; ctx.textAlign = 'right';
      ctx.fillText(`get(${f.readKey})`, w - 14, 14); ctx.textAlign = 'center';
    }
  }

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input value={keysText} onInput={(e) => setKeysText((e.target as HTMLInputElement).value)}
          class="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="keys to write (comma-separated)" />
        <input value={readText} onInput={(e) => setReadText((e.target as HTMLInputElement).value)}
          class="w-24 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="read key" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">frame {Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Memtable flushes at {MEM_CAP} keys; Level 0 compacts at {L0_COMPACT} SSTables. Keys are 0–99.</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Two-in-one lab for the tokenization-&-scaling lesson.
   TAB 1 "Tokenizer": step-by-step Byte-Pair Encoding. Start from
     characters and apply the highest-priority adjacent merge each step.
   TAB 2 "Scaling": a log–log scaling-law curve. Reducible loss
     (L − E) = A·C^(−α) is a straight line on log–log axes; a slider
     moves the compute budget and reads off loss & perplexity.
   Canvas for the scaling plot (VectorPlayground dpr conventions).
   ------------------------------------------------------------------ */

// ranked merge table (lower index = higher priority), like a learned BPE vocab
const MERGES: [string, string][] = [
  ['e', 'r'], ['i', 'n'], ['t', 'i'], ['o', 'n'], ['ti', 'on'], ['t', 'h'], ['th', 'e'],
  ['a', 't'], ['e', 'n'], ['l', 'o'], ['in', 'g'], ['r', 'e'], ['s', 't'], ['er', 's'],
  ['o', 'r'], ['l', 'l'], ['a', 'l'], ['en', 't'], ['m', 'e'], ['s', 'e'], ['r', 'a'],
  ['v', 'e'], ['i', 'e'], ['a', 'n'], ['c', 'h'],
];
const rankOf = (a: string, b: string) => MERGES.findIndex(([x, y]) => x === a && y === b);

const COLORS = { line: '#4f46e5', floor: '#10b981', grid: 'rgba(128,128,128,0.18)', axis: 'rgba(128,128,128,0.5)' };

// scaling law: L(C) = E + A * C^(-alpha)
const E = 1.69, A = 10, ALPHA = 0.05;
const C_MIN = 15, C_MAX = 24; // log10 FLOPs

export default function BPEScalingLab() {
  const [tab, setTab] = useState<'tok' | 'scale'>('tok');
  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex gap-2">
        {(['tok', 'scale'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {t === 'tok' ? 'BPE tokenizer' : 'Scaling law'}
          </button>
        ))}
      </div>
      {tab === 'tok' ? <Tokenizer /> : <Scaling />}
    </div>
  );
}

function Tokenizer() {
  const [word, setWord] = useState('tokenization');
  const [tokens, setTokens] = useState<string[]>('tokenization'.split(''));

  const reset = (w: string) => { setWord(w); setTokens(w.split('')); };

  // find the next merge: lowest-rank adjacent pair currently present
  const nextMerge = () => {
    let best = -1, bestRank = Infinity;
    for (let i = 0; i < tokens.length - 1; i++) {
      const r = rankOf(tokens[i], tokens[i + 1]);
      if (r !== -1 && r < bestRank) { bestRank = r; best = i; }
    }
    return best;
  };
  const mi = nextMerge();

  const step = () => {
    if (mi < 0) return;
    const merged = tokens[mi] + tokens[mi + 1];
    setTokens([...tokens.slice(0, mi), merged, ...tokens.slice(mi + 2)]);
  };

  return (
    <div class="space-y-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <input
          value={word}
          onInput={(e) => reset((e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z]/g, ''))}
          class="w-40 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono"
          placeholder="type a word"
        />
        {['tokenization', 'retrieval', 'entertainment'].map((w) => (
          <button key={w} onClick={() => reset(w)} class="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-text">{w}</button>
        ))}
      </div>

      <div class="flex min-h-[64px] flex-wrap items-center gap-1.5 rounded-xl bg-surface-2 p-3">
        {tokens.map((t, i) => {
          const inMerge = i === mi || i === mi + 1;
          return (
            <span key={i}
              class="rounded-md px-2.5 py-1.5 font-mono font-semibold"
              style={`background:${inMerge ? 'rgba(16,185,129,0.18)' : 'rgba(79,70,229,0.14)'};color:${inMerge ? '#10b981' : '#4f46e5'};outline:${inMerge ? '2px solid #10b981' : 'none'}`}>
              {t}
            </span>
          );
        })}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button onClick={step} disabled={mi < 0}
          class={`rounded-lg px-3 py-1.5 font-semibold ${mi < 0 ? 'bg-surface-2 text-muted' : 'bg-brand text-white'}`}>
          {mi < 0 ? 'No more merges' : 'Merge next pair ›'}
        </button>
        <button onClick={() => reset(word)} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">Reset</button>
        <span class="text-xs text-muted">
          {mi >= 0 ? <>Next rule: <strong class="font-mono">{tokens[mi]}</strong> + <strong class="font-mono">{tokens[mi + 1]}</strong> → <strong class="font-mono">{tokens[mi] + tokens[mi + 1]}</strong></> : 'These are the final subword tokens.'}
        </span>
      </div>

      <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Started from <strong>{word.length}</strong> characters → now <strong>{tokens.length}</strong> tokens.
        BPE greedily merges the most frequent adjacent pair, building common chunks like
        <span class="font-mono"> "tion"</span> and <span class="font-mono"> "ing"</span> while rare words stay split into pieces — so the vocabulary never runs out of words.
      </div>
    </div>
  );
}

function Scaling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logC, setLogC] = useState(18);
  const sizeRef = useRef({ w: 480, h: 300 });

  const reducible = (lc: number) => A * Math.pow(Math.pow(10, lc), -ALPHA);
  const lossAt = (lc: number) => E + reducible(lc);

  const pad = { L: 48, R: 14, T: 16, B: 40 };
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const x0 = pad.L, y0 = h - pad.B, plotW = w - pad.L - pad.R, plotH = h - pad.B - pad.T;

    // y = log10(reducible loss)
    const yTop = Math.log10(reducible(C_MIN)) + 0.05;
    const yBot = Math.log10(reducible(C_MAX)) - 0.05;
    const toX = (lc: number) => x0 + ((lc - C_MIN) / (C_MAX - C_MIN)) * plotW;
    const toY = (ly: number) => y0 - ((ly - yBot) / (yTop - yBot)) * plotH;

    // grid
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let ly = Math.ceil(yBot * 10) / 10; ly <= yTop; ly += 0.1) {
      const yy = toY(ly);
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + plotW, yy); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let lc = C_MIN; lc <= C_MAX; lc += 3) {
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.fillText(`10^${lc}`, toX(lc), y0 + 6);
    }
    ctx.save();
    ctx.translate(14, y0 - plotH / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('reducible loss (log)', 0, 0);
    ctx.restore();
    ctx.textBaseline = 'top';
    ctx.fillText('compute / data / params (log FLOPs)', x0 + plotW / 2, y0 + 22);

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, pad.T); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();

    // straight power-law line
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(C_MIN), toY(Math.log10(reducible(C_MIN))));
    ctx.lineTo(toX(C_MAX), toY(Math.log10(reducible(C_MAX))));
    ctx.stroke();

    // current point
    const px = toX(logC), py = toY(Math.log10(reducible(logC)));
    ctx.fillStyle = COLORS.floor;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(128,128,128,0.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, y0); ctx.stroke();
    ctx.setLineDash([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(draw, [logC]);

  const loss = lossAt(logC);
  const ppl = Math.exp(loss);

  return (
    <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start text-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      <div class="space-y-3 md:w-56">
        <label class="block">
          <span class="mb-1 block text-muted">training compute ≈ 10^{logC} FLOPs</span>
          <input type="range" min={C_MIN} max={C_MAX} step={0.1} value={logC}
            onInput={(e) => setLogC(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
        <Readout label="predicted loss L" value={`${loss.toFixed(3)} nats`} />
        <Readout label="perplexity exp(L)" value={ppl.toFixed(2)} />
        <Readout label="irreducible floor E" color={COLORS.floor} value={`${E.toFixed(2)} nats`} />
        <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          A <strong>straight line on log–log axes</strong> is the fingerprint of a power law: every 10× of compute cuts the reducible loss by the same factor — but it only ever approaches the floor <strong>E</strong>, never beats it.
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

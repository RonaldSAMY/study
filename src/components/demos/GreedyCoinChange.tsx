import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Greedy coin change — the canonical "is greedy optimal?" demo.
   - Edit the target amount and the coin set. The demo repeatedly grabs
     the LARGEST coin that still fits (the locally best move) until the
     amount hits zero.
   - We also compute the true minimum (a tiny DP) so the demo can SHOW
     when greedy matches the optimum and when it fails (e.g. coins
     [1,3,4], amount 6 → greedy 3 coins, optimal 2 coins).
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { pick: '#10b981', cur: '#0ea5e9', brand: '#4f46e5' };

type Frame = { remainingBefore: number; coin: number; remainingAfter: number; picks: number[] };

const parseCoins = (s: string): number[] => {
  const c = s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x) && x > 0);
  return Array.from(new Set(c)).sort((a, b) => b - a);
};

// Greedy run: always take the largest coin that fits.
function greedyFrames(amount: number, coins: number[]): Frame[] {
  const frames: Frame[] = [];
  const picks: number[] = [];
  let remaining = amount;
  let guard = 0;
  while (remaining > 0 && guard++ < 1000) {
    const coin = coins.find((c) => c <= remaining);
    if (coin == null) break; // cannot make exact change
    const before = remaining;
    remaining -= coin;
    picks.push(coin);
    frames.push({ remainingBefore: before, coin, remainingAfter: remaining, picks: [...picks] });
  }
  return frames;
}

// True minimum number of coins via DP (or -1 if impossible).
function dpMinCoins(amount: number, coins: number[]): number {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const c of coins) if (c <= i && dp[i - c] + 1 < dp[i]) dp[i] = dp[i - c] + 1;
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

export default function GreedyCoinChange() {
  const [amtText, setAmtText] = useState('63');
  const [coinText, setCoinText] = useState('25, 10, 5, 1');
  const [amount, setAmount] = useState(63);
  const [coins, setCoins] = useState<number[]>(() => parseCoins('25, 10, 5, 1'));

  const [idx, setIdx] = useState(0); // 0..frames.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = greedyFrames(amount, coins);
  const optimal = dpMinCoins(amount, coins);

  const commit = () => {
    const a = parseInt(amtText.trim(), 10);
    const c = parseCoins(coinText);
    if (Number.isFinite(a) && a > 0 && a <= 200 && c.length) {
      setAmount(a);
      setCoins(c);
      setIdx(0);
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length + 1) {
          setIdx(frames.length);
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, amount, coins]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = idx > 0 ? frames[idx - 1] : null;
  const remaining = cur ? cur.remainingAfter : amount;
  const picks = cur ? cur.picks : [];
  const done = idx >= frames.length;
  const greedyCount = frames.length;
  const exactlyMade = frames.length > 0 ? frames[frames.length - 1].remainingAfter === 0 : amount === 0;

  const caption = idx === 0
    ? `Goal: make ${amount} using the fewest coins. The greedy rule: grab the biggest coin that still fits.`
    : `Largest coin that fits in ${cur!.remainingBefore} is ${cur!.coin} — locally the biggest dent we can make. Remaining: ${cur!.remainingBefore} − ${cur!.coin} = ${cur!.remainingAfter}.`;

  const nextCoin = !done && remaining > 0 ? coins.find((c) => c <= remaining) : undefined;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <label class="flex items-center gap-2 text-sm text-muted">amount
          <input value={amtText} onInput={(e) => setAmtText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-2 text-sm text-muted">coins
          <input value={coinText} onInput={(e) => setCoinText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="25, 10, 5, 1" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* coin palette — highlight the coin greedy is about to take */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {coins.map((c) => (
          <span key={c} class={`rounded-full border px-3 py-1.5 transition ${c === nextCoin ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={c === nextCoin ? `background:${COLORS.cur}` : ''}>{c}</span>
        ))}
      </div>

      {/* remaining + picked coins */}
      <div class="mt-3 flex flex-wrap items-center gap-2 font-mono text-sm">
        <span class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-text">remaining: <span style={`color:${COLORS.cur}`}>{remaining}</span></span>
        <span class="text-muted">picked:</span>
        {picks.length === 0 && <span class="text-muted">—</span>}
        {picks.map((c, i) => (
          <span key={i} class="rounded-md border border-transparent px-2.5 py-1 font-semibold text-white" style={`background:${COLORS.pick}`}>{c}</span>
        ))}
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      {done && exactlyMade && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Greedy used {greedyCount} coin{greedyCount === 1 ? '' : 's'}. Optimal is {optimal}.{' '}
          {greedyCount === optimal
            ? 'They match — for this coin system greedy is provably optimal.'
            : `Greedy LOST: it took ${greedyCount - optimal} coin(s) too many. Local greed misses the optimum here — DP wins.`}
        </p>
      )}
      {done && !exactlyMade && (
        <p class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-rose-500">
          Greedy got stuck with {remaining} left over — these coins cannot make {amount} this way.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try the canonical set 25,10,5,1 (greedy wins), then try coins 1,3,4 with amount 6 to watch greedy fail.</p>
    </div>
  );
}

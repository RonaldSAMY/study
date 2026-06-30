import { useEffect, useRef, useState } from 'preact/hooks';
import { url } from '../lib/url';

interface Doc {
  slug: string;
  title: string;
  summary: string;
  track: string;
  icon: string;
  stage: string;
  course: 'ml' | 'gamedev';
  ready: boolean;
  text: string;
}

const COURSE_LABEL: Record<string, string> = { ml: 'ML Maths', gamedev: 'Game Dev' };
interface Hit extends Doc { score: number; snippet: string; }

let CACHE: Doc[] | null = null;

async function loadIndex(): Promise<Doc[]> {
  if (CACHE) return CACHE;
  const res = await fetch(`${import.meta.env.BASE_URL}search.json`);
  CACHE = (await res.json()) as Doc[];
  return CACHE;
}

function makeSnippet(text: string, term: string): string {
  if (!text) return '';
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 110) + '…';
  const start = Math.max(0, i - 45);
  return (start > 0 ? '…' : '') + text.slice(start, start + 120).trim() + '…';
}

function search(docs: Doc[], q: string): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const d of docs) {
    const title = d.title.toLowerCase();
    const summary = d.summary.toLowerCase();
    const track = d.track.toLowerCase();
    const text = d.text.toLowerCase();
    let score = 0;
    let ok = true;
    for (const t of terms) {
      let s = 0;
      if (title.includes(t)) s += 10;
      if (summary.includes(t)) s += 5;
      if (track.includes(t)) s += 4;
      if (text.includes(t)) s += 1;
      if (s === 0) { ok = false; break; }
      score += s;
    }
    if (ok) {
      if (title.startsWith(terms[0])) score += 6; // prefer prefix title matches
      hits.push({ ...d, score, snippet: makeSnippet(d.text || d.summary, terms[0]) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

export default function Search() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the index on first focus.
  const ensure = () => { if (!docs) loadIndex().then(setDocs).catch(() => {}); };

  useEffect(() => {
    setHits(docs ? search(docs, q) : []);
    setSel(0);
  }, [q, docs]);

  // Global Cmd/Ctrl-K to focus the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ensure();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (h: Hit) => { window.location.href = url(`/${h.slug}`); };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); go(hits[sel]); }
    else if (e.key === 'Escape') { setQ(''); inputRef.current?.blur(); }
  };

  return (
    <div class="relative">
      <div class="relative">
        <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onFocus={ensure}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
          placeholder="Search lessons…"
          aria-label="Search lessons"
          class="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-brand focus:bg-surface"
        />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Clear" class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {q && (
        <div class="mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {hits.length === 0 ? (
            <p class="px-3 py-4 text-sm text-muted">No matches for “{q}”.</p>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={h.slug}>
                  <a
                    href={url(`/${h.slug}`)}
                    onMouseEnter={() => setSel(i)}
                    class={`block border-b border-border px-3 py-2 last:border-0 ${i === sel ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
                  >
                    <div class="flex items-center gap-2">
                      <span>{h.icon}</span>
                      <span class="flex-1 text-sm font-semibold leading-tight">{h.title}</span>
                      {!h.ready && <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">soon</span>}
                    </div>
                    <div class="mt-0.5 text-xs text-muted">{COURSE_LABEL[h.course] ?? ''} · {h.track}</div>
                    {h.snippet && <div class="mt-1 line-clamp-2 text-xs text-muted">{h.snippet}</div>}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p class="border-t border-border px-3 py-1.5 text-[11px] text-muted">↑↓ to navigate · ↵ to open · ⌘K to focus</p>
        </div>
      )}
    </div>
  );
}

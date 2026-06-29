import { useEffect, useState } from 'preact/hooks';
import { getCompleted, setCompleted } from '../lib/progress';

interface Props {
  slug: string;
}

/** "Mark complete" button shown at the end of every lesson. */
export default function ProgressTracker({ slug }: Props) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(getCompleted().has(slug));
  }, [slug]);

  const toggle = () => {
    const set = setCompleted(slug, !done);
    setDone(set.has(slug));
  };

  return (
    <button
      onClick={toggle}
      class={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition ${
        done
          ? 'bg-calculus/15 text-calculus ring-1 ring-calculus/40'
          : 'bg-brand text-white shadow hover:brightness-110'
      }`}
    >
      {done ? (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          Completed — nice work!
        </>
      ) : (
        <>Mark this lesson complete</>
      )}
    </button>
  );
}

/* Tiny localStorage-backed progress store shared by the islands.
   A lesson slug is "<trackId>/<lessonId>". */

const KEY = 'mml-progress-v1';

export function getCompleted(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function isCompleted(slug: string): boolean {
  return getCompleted().has(slug);
}

export function setCompleted(slug: string, done: boolean): Set<string> {
  const set = getCompleted();
  if (done) set.add(slug);
  else set.delete(slug);
  localStorage.setItem(KEY, JSON.stringify([...set]));
  // Let any listeners (e.g. the sidebar) react.
  window.dispatchEvent(new CustomEvent('mml:progress', { detail: { slug, done } }));
  return set;
}

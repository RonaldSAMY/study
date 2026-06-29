/* Base-path-aware URL helpers.
   `import.meta.env.BASE_URL` reflects the `base` set at build time:
   - "/"        for local dev and the Docker (root-served) build
   - "/study/"  for the GitHub Pages project-site build (BASE_PATH=/study)
   Using these everywhere lets the SAME code serve correctly at the root
   OR under a sub-path, with no link rewrites per deploy target. */

const BASE = import.meta.env.BASE_URL; // always has a trailing slash, e.g. "/" or "/study/"

/** Prefix an absolute in-site path with the base. `url('/path')` -> '/study/path'. */
export function url(path = '/'): string {
  if (!path || path === '/') return BASE;
  const b = BASE.replace(/\/$/, ''); // "" or "/study"
  return b + (path.startsWith('/') ? path : `/${path}`);
}

/** Strip the base + surrounding slashes from a pathname to recover a lesson slug.
    stripBase('/study/linear-algebra/vectors') -> 'linear-algebra/vectors'. */
export function stripBase(pathname: string): string {
  const b = BASE.replace(/\/$/, '');
  let p = pathname;
  if (b && p.startsWith(b)) p = p.slice(b.length);
  return p.replace(/^\/|\/$/g, '');
}

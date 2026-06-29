import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
// `base`/`site` are env-driven so the SAME source serves:
//   - at root "/"  for local dev + the Docker (nginx) build  (defaults)
//   - under "/study" for GitHub Pages, when the CI sets BASE_PATH=/study
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  integrations: [
    preact({ compat: true }),
    tailwind(),
    mdx(),
  ],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});

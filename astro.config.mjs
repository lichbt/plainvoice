// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical site URL — drives <link rel="canonical">, og:url and the sitemap.
  site: 'https://plainvoice.co',
  // Index the marketing homepage + blog; keep the blank local-first app shells
  // (/new, /app, /invoice, /estimate) out of the sitemap.
  integrations: [react(), sitemap({
    filter: (page) => {
      const p = new URL(page).pathname;
      return p === '/' || p === '/blog/' || p.startsWith('/blog/');
    },
  })],

  vite: {
    plugins: [tailwindcss()],
  },
});
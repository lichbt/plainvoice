// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical site URL — drives <link rel="canonical">, og:url and the sitemap.
  // TODO: swap to the custom domain when chosen (also update public/robots.txt).
  site: 'https://plainvoice.pages.dev',
  // Only the marketing homepage is real content; /new, /app, /invoice, /estimate
  // are blank local-first app shells, so keep them out of the sitemap.
  integrations: [react(), sitemap({ filter: (page) => new URL(page).pathname === '/' })],

  vite: {
    plugins: [tailwindcss()],
  },
});
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Public URL used for canonical links and metadata; the deploy script passes the real one.
  site: process.env.SITE_URL ?? 'https://awscommunity.es',
  output: 'static',
  build: {
    format: 'directory',
  },
});

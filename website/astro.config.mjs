// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://newecloud.io',
  output: 'static',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [mdx(), sitemap()],
  adapter: vercel(),
  env: {
    schema: {
      ANTHROPIC_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      UPSTASH_REDIS_REST_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      UPSTASH_REDIS_REST_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      BREVO_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      BREVO_LIST_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});

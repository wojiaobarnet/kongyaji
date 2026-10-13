import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from './build/sites-vite-plugin';

process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
process.env.WRANGLER_SEND_METRICS ??= 'false';
process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';

export default defineConfig({
  plugins: [sites({ mockAuth: false }), cloudflare({
    viteEnvironment: { name: 'server' },
    inspectorPort: false,
    config: {
      name: 'kaishan-sales-replica',
      main: './worker/index.js',
      compatibility_date: '2026-05-15',
      assets: { binding: 'ASSETS', run_worker_first: true, html_handling: 'none', not_found_handling: 'none' },
      d1_databases: [{ binding: 'DB', database_name: 'kaishan-inquiries', database_id: '00000000-0000-4000-8000-000000000000', migrations_dir: '../../drizzle' }]
    }
  })],
  server: { host: '127.0.0.1' }
});

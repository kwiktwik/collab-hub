import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'libsql',
  dbCredentials: {
    url: 'file:./data/collab-hub.db'
  }
} satisfies Config;

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const client = createClient({
  url: `file:${path.join(DATA_DIR, 'collab-hub.db')}`
});

export const db = drizzle(client, { schema });

export default db;

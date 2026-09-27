// Deletes the local SQLite database; it is recreated and re-seeded on the next request.
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ridgeline.db');
for (const f of [file, `${file}-wal`, `${file}-shm`]) {
  try {
    fs.rmSync(f);
    console.log('removed', f);
  } catch {}
}

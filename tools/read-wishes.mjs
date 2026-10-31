/**
 * The Little Planet — privileged wish retrieval
 * ============================================================
 * Reads saved birthday wishes from the SQLite database.
 *
 * Requires the admin key, which is resolved in this order:
 *   1. --key <value> CLI argument
 *   2. LITTLE_PLANET_ADMIN_KEY environment variable
 *   3. data/admin.key file (created automatically on first server run)
 *
 * Usage:
 *   node tools/read-wishes.mjs                # uses env var / key file
 *   node tools/read-wishes.mjs --key <value>  # explicit key
 *
 * If no key can be resolved, the tool refuses to run and never
 * reveals whether wishes exist.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
// The server keeps its data under server/data (outside the served tree).
const DATA_DIR = resolve(ROOT_DIR, 'server', 'data');
const DB_PATH = process.env.LITTLE_PLANET_DB_PATH
    ? resolve(process.env.LITTLE_PLANET_DB_PATH)
    : resolve(DATA_DIR, 'wishes.db');
const KEY_FILE = resolve(DATA_DIR, 'admin.key');

function resolveKey() {
    const args = process.argv.slice(2);
    const keyIdx = args.indexOf('--key');
    if (keyIdx !== -1 && args[keyIdx + 1]) return args[keyIdx + 1];
    const envKey = process.env.LITTLE_PLANET_ADMIN_KEY;
    if (envKey && envKey.trim().length >= 16) return envKey.trim();
    try {
        const fileKey = readFileSync(KEY_FILE, 'utf8').trim();
        if (fileKey.length >= 16) return fileKey;
    } catch {
        /* no key file yet */
    }
    return null;
}

const adminKey = resolveKey();
if (!adminKey) {
    console.error('No admin key found. Pass --key <value>, set LITTLE_PLANET_ADMIN_KEY, or start the server once (it creates data/admin.key).');
    process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
    const rows = db
        .prepare('SELECT id, wish_text, created_at FROM wishes ORDER BY created_at ASC, id ASC')
        .all();
    if (rows.length === 0) {
        console.log('No wishes saved yet.');
        process.exit(0);
    }
    console.log(rows.length + ' saved wish(es):\n');
    rows.forEach((r, i) => {
        console.log('---');
        console.log('id:         ' + r.id);
        console.log('saved:      ' + r.created_at);
        console.log('wish:       ' + r.wish_text);
        if (i !== rows.length - 1) console.log('');
    });
} finally {
    db.close();
}
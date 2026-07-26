import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Writable data dir — /tmp on Vercel (read-only elsewhere in the deploy). */
export function getDataDir() {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'schootype-data');
  }
  return path.join(__dirname, 'data');
}

import fs from 'node:fs';
import path from 'node:path';

// Wipe the throwaway API data dir before the run so tests start from a clean,
// deterministic store (fresh accounts, empty pool). Runs before the webServers.
export default function globalSetup() {
  const dir = path.resolve(process.cwd(), '.e2e-data');
  fs.rmSync(dir, { recursive: true, force: true });
}

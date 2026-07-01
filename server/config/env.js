// Load .env into process.env before any other module reads it.
//
// Import this FIRST in the server entrypoint — ESM evaluates imports depth-first
// in source order, so importing this before ./config/database.js or
// ./middleware/auth.js guarantees their top-level env reads (DATABASE_URL,
// JWT_SECRET) see the loaded values. Missing .env is fine (local dev defaults).
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on real environment variables / in-code dev defaults.
}

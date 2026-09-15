// Root server entry point for Cloud Run and production deployments (ESM compatible)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./dist/server.cjs');

import { config } from "dotenv";
import path from "path";

// Load .env.local for integration tests (DB connection, API keys, etc.)
// dotenv 17+ handles indented lines correctly.
config({
  path: path.resolve(process.cwd(), ".env.local"),
  override: true,
});

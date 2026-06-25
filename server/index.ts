import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DASHBOARD_DB_PATH ?? path.resolve(process.cwd(), "data", "dashboard.db");
const staticDir = process.env.DASHBOARD_STATIC_DIR ?? path.resolve(__dirname, "..", "dist");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const app = createApp({
  dbPath,
  staticDir: fs.existsSync(staticDir) ? staticDir : undefined,
  secureCookies: process.env.DASHBOARD_SECURE_COOKIES !== "false"
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Dashboard CQ listening on http://127.0.0.1:${port}`);
});

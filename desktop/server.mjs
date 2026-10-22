// The native app owns this process. No Terminal window or fixed port is needed.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, statSync } from "node:fs";
import { once } from "node:events";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.env.NODE_ENV = "production";
process.env.DEMO_MODE = "false";
process.env.PATH = `${dirname(process.execPath)}:${process.env.PATH || "/usr/bin:/bin"}`;
let nextApp;
let httpServer;
let preparing;
let closing = false;
const event = (kind, value) => console.log(`INTERNSHIPHQ_${kind} ${JSON.stringify(value)}`);

async function stop() {
  if (closing) return;
  closing = true;
  preparing?.kill("SIGTERM");
  const exitCode = Number(process.exitCode) || 0;
  const timeout = setTimeout(() => process.exit(exitCode), 3000);
  timeout.unref();
  httpServer?.closeAllConnections();
  if (httpServer?.listening) await new Promise(resolve => httpServer.close(resolve));
  await nextApp?.close();
  process.exit(exitCode);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
// The pipe closes even if the native app crashes: don't leave an orphan server.
process.stdin.resume();
process.stdin.on("end", stop);

async function command(args) {
  preparing = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: ["ignore", "inherit", "inherit"] });
  const [code] = await once(preparing, "exit");
  preparing = undefined;
  if (code !== 0) throw new Error(`Setup step failed (${args.join(" ")}). See the app log for details.`);
}

function newestSource(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(stat.mtimeMs, ...readdirSync(path).filter(name => name !== "generated").map(name => newestSource(resolve(path, name))));
}
function buildNeeded() {
  const id = resolve(root, ".next/BUILD_ID");
  if (!existsSync(id) || process.env.INTERNSHIPHQ_REBUILD === "1") return true;
  const built = statSync(id).mtimeMs;
  return ["src", "public", "prisma/schema.prisma", "prisma/migrations", "next.config.ts", "package-lock.json"].some(path => newestSource(resolve(root, path)) > built);
}

try {
  event("STATUS", "Opening your local database…");
  await command(["--import", "tsx", "scripts/prepare-db.ts"]);
  await command(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (buildNeeded()) {
    event("STATUS", "Preparing InternshipHQ. The first launch after code changes may take a minute…");
    await command(["node_modules/prisma/build/index.js", "generate"]);
    await command(["node_modules/next/dist/bin/next", "build", "--webpack"]);
  }
  event("STATUS", "Starting your workspace…");
  const { default: next } = await import("next");
  nextApp = next({ dev: false, dir: root, hostname: "127.0.0.1" });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  httpServer = createServer((req, res) => handle(req, res));
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const { port } = httpServer.address();
  event("READY", { url: `http://127.0.0.1:${port}` });
} catch (error) {
  event("ERROR", error instanceof Error ? error.message : String(error));
  console.error(error);
  process.exitCode = 1;
  await stop();
}

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readlinkSync, mkdirSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

if (process.platform !== "darwin") throw new Error("This installer is for macOS.");
const source = resolve("desktop/dist/InternshipHQ.app");
if (!existsSync(source)) throw new Error("Build the desktop app first with npm run desktop:build.");
const target = join(homedir(), "Applications/InternshipHQ.app");
const shortcut = join(homedir(), "Desktop/InternshipHQ.app");
mkdirSync(join(homedir(), "Applications"), { recursive: true });
if (existsSync(target)) {
  const id = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", join(target, "Contents/Info.plist")], { encoding: "utf8" }).trim();
  if (id !== "local.internshiphq.desktop") throw new Error("An unrelated app already uses this name. It was not changed.");
  const backup = `${target}.previous-${Date.now()}`;
  renameSync(target, backup);
  try { execFileSync("/usr/bin/ditto", [source, target]); } catch (error) { if (existsSync(target)) rmSync(target, { recursive: true }); renameSync(backup, target); throw error; }
  console.log(`Previous launcher retained at ${backup}`);
} else execFileSync("/usr/bin/ditto", [source, target]);
try {
  const stat = lstatSync(shortcut);
  if (!stat.isSymbolicLink() || readlinkSync(shortcut) !== target) throw new Error("The Desktop already has an item called InternshipHQ.app. It was not changed; the app is installed in your Applications folder.");
} catch (error) {
  if (error.code === "ENOENT") symlinkSync(target, shortcut);
  else throw error;
}
execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", target]);
console.log(`Installed: ${target}\nDesktop shortcut: ${shortcut}`);

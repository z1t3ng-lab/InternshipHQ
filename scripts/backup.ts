import "dotenv/config";
import { createBackup, backupPath } from "../src/lib/backups";
const name = await createBackup();
console.log(`Consistent SQLite backup saved to ${backupPath(name)}`);

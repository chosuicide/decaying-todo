import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const webDir = join(root, "www");
const assets = ["index.html", "styles.css", "app.js"];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const asset of assets) {
  await copyFile(join(root, asset), join(webDir, asset));
}

console.log(`Synced ${assets.length} web assets to www/`);

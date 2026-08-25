import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const clientDirectory = resolve(distDirectory, "client");
const serverDirectory = resolve(distDirectory, "server");
const pagesDirectory = resolve(distDirectory, "pages");
const pagesWorkerDirectory = resolve(pagesDirectory, "_worker.js");
const viteDeployRedirect = resolve(".wrangler", "deploy", "config.json");

await rm(pagesDirectory, { force: true, recursive: true });
await mkdir(pagesDirectory, { recursive: true });
await cp(clientDirectory, pagesDirectory, { recursive: true });
await cp(serverDirectory, pagesWorkerDirectory, { recursive: true });
await rm(resolve(pagesWorkerDirectory, "wrangler.json"), { force: true });
await rm(viteDeployRedirect, { force: true });

console.log("Prepared Cloudflare Pages output in dist/pages.");

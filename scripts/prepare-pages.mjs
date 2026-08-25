import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
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

const workerEntry = resolve(pagesWorkerDirectory, "index.js");
const serverWorkerEntry = resolve(pagesWorkerDirectory, "server.js");

await rename(workerEntry, serverWorkerEntry);
await writeFile(
  workerEntry,
  `import serverWorker from "./server.js";

export default {
  async fetch(request, env, context) {
    const pathname = new URL(request.url).pathname;
    const isStaticAsset = pathname.startsWith("/_next/") || /\\.[a-z0-9]+$/i.test(pathname);

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      isStaticAsset &&
      env.ASSETS
    ) {
      const assetResponse = await env.ASSETS.fetch(request);

      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return serverWorker.fetch(request, env, context);
  },
};
`,
);

console.log("Prepared Cloudflare Pages output in dist/pages.");

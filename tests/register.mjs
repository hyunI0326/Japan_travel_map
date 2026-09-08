import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

// Exercise the actual planner without credentials or external API requests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: "data:text/javascript,export const env = globalThis.__testCloudflareEnv ?? {};",
        shortCircuit: true,
      };
    }
    if (specifier.startsWith("@/")) {
      const file = new URL(`../${specifier.slice(2)}.ts`, import.meta.url);
      return nextResolve(existsSync(file) ? file.href : new URL(`../${specifier.slice(2)}/index.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

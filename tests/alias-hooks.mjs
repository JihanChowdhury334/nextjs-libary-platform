import { fileURLToPath, pathToFileURL } from "node:url";
import { statSync } from "node:fs";
import path from "node:path";

// Two things the Node test runner does not do that the Next.js compiler does:
// resolve the "@/..." alias from tsconfig.json, and fill in the extension on an
// extensionless relative import. This hook does both so test files and the
// application share one copy of the source.

const SRC = path.resolve(process.cwd(), "src");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function firstFile(candidates) {
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      // not there; try the next candidate
    }
  }
  return null;
}

function variants(base) {
  return [
    base,
    ...EXTENSIONS.map((e) => `${base}${e}`),
    ...EXTENSIONS.map((e) => path.join(base, `index${e}`)),
  ];
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = firstFile(variants(path.join(SRC, specifier.slice(2))));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const hit = firstFile(variants(base));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

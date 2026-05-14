import { access } from "node:fs/promises";
import { extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(fileURLToPath(new URL("..", import.meta.url)));

async function firstExistingPath(basePath) {
  const candidates = extname(basePath)
    ? [basePath]
    : [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.mjs`,
        resolvePath(basePath, "index.ts"),
        resolvePath(basePath, "index.tsx"),
        resolvePath(basePath, "index.js"),
        resolvePath(basePath, "index.mjs")
      ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const filePath = await firstExistingPath(
      resolvePath(root, specifier.slice(2))
    );

    if (filePath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(filePath).href
      };
    }
  }

  return nextResolve(specifier, context);
}

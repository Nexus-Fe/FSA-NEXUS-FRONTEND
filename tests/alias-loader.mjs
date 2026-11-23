import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const targetPath = pathResolve(process.cwd(), "src", specifier.slice(2));
    for (const ext of EXTENSIONS) {
      try {
        return await nextResolve(pathToFileURL(targetPath + ext).href, context);
      } catch {}
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      const targetPath = pathResolve(parentDir, specifier);
      for (const ext of EXTENSIONS) {
        try {
          return await nextResolve(pathToFileURL(targetPath + ext).href, context);
        } catch {}
      }
    }
  }

  return nextResolve(specifier, context);
}

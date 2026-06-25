import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../");

export default {
  resolve: {
    alias: [
      {
        find: /^camado\/control$/,
        replacement: resolve(repoRoot, "src/control/index.ts"),
      },
      {
        find: /^camado\/core$/,
        replacement: resolve(repoRoot, "src/core/index.ts"),
      },
      {
        find: /^camado\/reactive$/,
        replacement: resolve(repoRoot, "src/reactive/index.ts"),
      },
      {
        find: /^camado\/html$/,
        replacement: resolve(repoRoot, "src/html/index.ts"),
      },
      {
        find: /^camado\/modifiers$/,
        replacement: resolve(repoRoot, "src/modifiers/index.ts"),
      },
      {
        find: /^camado\/navigator$/,
        replacement: resolve(repoRoot, "src/navigator/index.ts"),
      },
      {
        find: /^camado\/svg$/,
        replacement: resolve(repoRoot, "src/svg/index.ts"),
      },
      {
        find: /^camado\/unit$/,
        replacement: resolve(repoRoot, "src/unit/index.ts"),
      },
      {
        find: /^camado\/validator$/,
        replacement: resolve(repoRoot, "src/validator/index.ts"),
      },
      { find: /^camado$/, replacement: resolve(repoRoot, "src/index.ts") },
    ],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
};

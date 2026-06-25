import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../");

export default {
  resolve: {
    alias: [
      {
        find: /^ustro\/control$/,
        replacement: resolve(repoRoot, "src/control/index.ts"),
      },
      {
        find: /^ustro\/core$/,
        replacement: resolve(repoRoot, "src/core/index.ts"),
      },
      {
        find: /^ustro\/reactive$/,
        replacement: resolve(repoRoot, "src/reactive/index.ts"),
      },
      {
        find: /^ustro\/html$/,
        replacement: resolve(repoRoot, "src/html/index.ts"),
      },
      {
        find: /^ustro\/modifiers$/,
        replacement: resolve(repoRoot, "src/modifiers/index.ts"),
      },
      {
        find: /^ustro\/navigator$/,
        replacement: resolve(repoRoot, "src/navigator/index.ts"),
      },
      {
        find: /^ustro\/svg$/,
        replacement: resolve(repoRoot, "src/svg/index.ts"),
      },
      {
        find: /^ustro\/unit$/,
        replacement: resolve(repoRoot, "src/unit/index.ts"),
      },
      {
        find: /^ustro\/validator$/,
        replacement: resolve(repoRoot, "src/validator/index.ts"),
      },
      { find: /^ustro$/, replacement: resolve(repoRoot, "src/index.ts") },
    ],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
};

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests hit local Supabase；冷启动 / 连接池压力下 5s 不够
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/lib/knowledge/**"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only 包默认 entry 在非 RSC 环境会主动抛错;
      // vitest 跑在 node 普通环境,需 alias 到包内的空实现,避免 import 即崩
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});

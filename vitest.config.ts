import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "happy-dom",
    // Тесты не должны ходить в сеть: трекер Umami (и любые другие внешние
    // скрипты) в happy-dom не скачиваются.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableJavaScriptEvaluation: true,
          disableCSSFileLoading: true,
          disableIframePageLoading: true,
        },
      },
    },
    globals: false,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 15000,
    hookTimeout: 15000,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.ts",
        "app/battle/**/*.ts",
        "app/gacha/**/*.ts",
        "types/**/*.ts",
        "middleware.ts",
      ],
      exclude: [
        "**/*.tsx",
        "**/*.d.ts",
        "app/gacha/actions.ts",
        "app/gacha/client-actions.ts",
        "app/gacha/art-sources.ts",
        "app/gacha/coin-actions.ts",
        "app/gacha/dust-actions.ts",
        "app/gacha/pity-actions.ts",
        "lib/supabase.ts",
        "lib/**/api.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})

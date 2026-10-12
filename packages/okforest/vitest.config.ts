import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      // cli.ts is the process bootstrap (argv, stdout, exit code): side effects
      // only, exercised through main() in tests and by hand.
      include: ["src/**"],
      exclude: ["src/cli.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
})

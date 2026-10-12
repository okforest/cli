import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/node.ts"],
  format: ["esm"],
  target: "node22",
  dts: true,
  clean: true,
})

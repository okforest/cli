#!/usr/bin/env node
import { main } from "./main.js"

const env = process.env
const color =
  env.FORCE_COLOR !== undefined
    ? env.FORCE_COLOR !== "0"
    : Boolean(process.stdout.isTTY) && env.NO_COLOR === undefined && env.TERM !== "dumb"

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  color,
  cwd: process.cwd(),
})

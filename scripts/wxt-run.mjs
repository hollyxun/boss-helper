#!/usr/bin/env node
/**
 * WXT CLI wrapper.
 *
 * WXT 0.21.x keeps a MessagePort/worker handle alive after non-dev commands
 * (prepare/build/zip) finish on Windows, so the CLI process never exits.
 * Calling the public WXT APIs directly and exiting afterwards keeps
 * `npm install`, `npm run build` and `npm run zip` usable on Node.js.
 */
import { build, prepare, zip } from 'wxt'

const argv = process.argv.slice(2)
const command = argv.shift()

function hasFlag(...flags) {
  return flags.some((flag) => argv.includes(flag))
}

function takeValue(...flags) {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index !== -1) return argv[index + 1]
  }
  return undefined
}

const config = {}
const browser = takeValue('-b', '--browser')
const manifestVersion = hasFlag('--mv3') ? 3 : hasFlag('--mv2') ? 2 : undefined
const mode = takeValue('-m', '--mode')
const configFile = takeValue('-c', '--config')

if (browser) config.browser = browser
if (manifestVersion) config.manifestVersion = manifestVersion
if (mode) config.mode = mode
if (configFile) config.configFile = configFile
if (hasFlag('--debug')) config.debug = true
if (hasFlag('--analyze', '--analyze-open')) {
  config.analysis = { enabled: true, open: hasFlag('--analyze-open') }
}

try {
  switch (command) {
    case 'prepare':
      await prepare(config)
      break
    case 'build':
      await build(config)
      break
    case 'zip':
      await zip({
        ...config,
        zip: hasFlag('--sources') ? { zipSources: true } : undefined,
      })
      break
    default:
      console.error(`Unsupported command: ${command ?? '(none)'}`)
      process.exit(1)
  }
} catch (error) {
  console.error(error)
  process.exit(1)
}

// Give the logger a tick to flush before tearing down the remaining handles.
await new Promise((resolve) => setTimeout(resolve, 50))
process.exit(0)

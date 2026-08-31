import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const required = (name) => {
  const value = process.env[name]?.trim()
  if (!value || value === 'unknown') {
    throw new Error(`${name} must identify the uploaded Sentry artifact`)
  }
  return value
}

const countMaps = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  let count = 0
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      count += await countMaps(path)
    } else if (entry.name.endsWith('.map')) {
      count += 1
    }
  }
  return count
}

const clientSourceMapCount = await countMaps('.output/public/_nuxt')
const serverSourceMapCount = await countMaps('.output/server')
if (clientSourceMapCount === 0 || serverSourceMapCount === 0) {
  throw new Error('Sentry upload cannot be receipted without client source maps')
}

const receipt = {
  release: required('SENTRY_RELEASE'),
  organization: required('SENTRY_ORG'),
  project: required('SENTRY_PROJECT'),
  clientSourceMapCount,
  serverSourceMapCount,
  sourceMapCount: clientSourceMapCount + serverSourceMapCount,
  uploadedAt: new Date().toISOString(),
}

await writeFile(
  '.output/server/sentry-upload-receipt.json',
  `${JSON.stringify(receipt, null, 2)}\n`,
)
console.log(
  `Sentry sourcemap upload receipt: ${clientSourceMapCount} client + ${serverSourceMapCount} server maps`,
)

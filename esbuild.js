const esbuild = require('esbuild')

const isWatch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'], // ⚠️ Must be external — provided by VS Code runtime
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  metafile: true,
}

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('[esbuild] Watching for changes...')
  } else {
    const result = await esbuild.build(buildOptions)
    const text = await esbuild.analyzeMetafile(result.metafile)
    console.log('[esbuild] Build complete:')
    console.log(text)
  }
}

main().catch(() => process.exit(1))

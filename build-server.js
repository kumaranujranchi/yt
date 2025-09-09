import { build } from 'esbuild'
import { readFileSync } from 'fs'

// Read package.json to get dependencies
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

// Get all production dependencies to externalize
const externals = Object.keys(pkg.dependencies || {})

// Add specific dev dependencies that should be externalized
externals.push(
  'vite',
  '@vitejs/plugin-react', 
  'tsx',
  'drizzle-kit',
  'esbuild'
)

// Exclude vite.config.js since it's only used in development
externals.push('../vite.config.js')

// Build server with proper externalization
build({
  entryPoints: ['./server/index.ts'],
  platform: 'node',
  bundle: true,
  format: 'esm',
  outfile: './dist/index.js',
  external: externals,
  logLevel: 'info',
}).catch(() => process.exit(1))
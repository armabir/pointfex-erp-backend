import { createServer } from 'vite'

async function main() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })

  try {
    const mod = await vite.ssrLoadModule('/tests/frontend.spec.ts')
    const results = mod.runFrontendSuite()
    for (const r of results) {
      console.log(`PASS  ${r.name}`)
    }
    console.log(`\n${results.length}/${results.length} frontend tests passed.`)
  } finally {
    await vite.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


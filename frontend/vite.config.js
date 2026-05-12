import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Docker: VITE_RPC_PROXY_TARGET=http://hardhat-node:8545 (set in docker-compose.yml)
// Native: defaults to localhost Hardhat node
const rpcTarget = process.env.VITE_RPC_PROXY_TARGET || 'http://127.0.0.1:8545'

// Custom middleware instead of Vite's built-in proxy — avoids any proxy-library
// quirks in Vite 8 and gives us explicit control over body forwarding.
function rpcProxy(target) {
  return {
    name: 'rpc-proxy',
    configureServer(server) {
      server.middlewares.use('/rpc', (req, res) => {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
            .then((upstream) => upstream.text())
            .then((text) => {
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(text)
            })
            .catch((err) => {
              res.statusCode = 502
              res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: err.message } }))
            })
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rpcProxy(rpcTarget)],
  server: {
    host: true,
    port: 5173,
  },
})

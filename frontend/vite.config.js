import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In Docker the frontend container reaches the hardhat container by service name.
// Natively (WSL2) both Vite and Hardhat are on the same loopback, so 127.0.0.1 works.
const rpcTarget = process.env.VITE_RPC_PROXY_TARGET || 'http://127.0.0.1:8545'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,   // bind 0.0.0.0 so Docker can expose the port
    port: 5173,
    proxy: {
      // All /rpc requests are forwarded server-side — zero CORS involvement
      '/rpc': {
        target: rpcTarget,
        changeOrigin: true,
        rewrite: () => '/',
      },
    },
  },
})

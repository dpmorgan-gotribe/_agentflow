import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false, // Allow fallback to next available port
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
        // Don't throw on connection errors - let the UI handle it
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[Vite Proxy] API connection error:', err.message);
          });
        },
      },
    },
  },
});

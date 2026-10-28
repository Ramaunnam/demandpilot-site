import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',                       // works when opened from a sub-path or a file server
  build: {
    target: 'es2020',
    cssCodeSplit: false,            // one small stylesheet: fewer requests than splitting it
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // React rarely changes; keeping it separate lets it stay cached across deploys.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
})

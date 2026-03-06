// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // CRITICAL: Adds the dot before paths
  plugins: [react()],
  build: {
    outDir: 'dist', // Ensures code goes into the frontend/dist folder
  }
})
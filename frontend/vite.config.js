import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Set base to your GitHub repo name when deploying to GitHub Pages
// e.g., base: '/my-repo-name/'
export default defineConfig({
  plugins: [react()],
  base: '/terminal/',
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
    },
  },
})

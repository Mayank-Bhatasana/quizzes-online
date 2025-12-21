import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src', // Tells Vite that index.html is inside src
  build: {
    outDir: '../dist', // Builds to a folder outside of src
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Maps the URL path to the actual file
        main: resolve(__dirname, 'src/index.html'),
        auth: resolve(__dirname, 'src/auth/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        difficulty: resolve(__dirname, 'src/difficulty/index.html'),
        quiz: resolve(__dirname, 'src/quiz/index.html'),
        results: resolve(__dirname, 'src/results/index.html'),
      },
    },
  },
})

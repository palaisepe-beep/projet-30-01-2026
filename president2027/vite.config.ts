import { defineConfig } from 'vite';

// Application 100 % statique. `base: './'` => les chemins sont relatifs, donc
// déployable tel quel sur Netlify (ou n'importe quel hébergement statique).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// Plugin: after build, copy public/ assets to project root
// Required because outDir:'.' and publicDir:'public' overlap
function copyPublicToRoot() {
  return {
    name: 'copy-public-to-root',
    closeBundle() {
      const root    = resolve(__dirname);
      const pubDir  = join(root, 'public');

      function copyDir(src, dest) {
        try {
          const entries = readdirSync(src);
          for (const entry of entries) {
            const srcPath  = join(src, entry);
            const destPath = join(dest, entry);
            const stat     = statSync(srcPath);
            if (stat.isDirectory()) {
              mkdirSync(destPath, { recursive: true });
              copyDir(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          }
        } catch (e) {
          console.warn('[copy-public-to-root]', e.message);
        }
      }

      copyDir(pubDir, root);
      console.log('[copy-public-to-root] public/ assets copied to root');
    }
  };
}

export default defineConfig({
  plugins: [react(), copyPublicToRoot()],
  base: './',
  build: {
    outDir: '.',
    emptyOutDir: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react':   ['react', 'react-dom'],
          'pdfjs':   ['pdfjs-dist'],
          'exceljs': ['exceljs'],
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  }
});

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o mesmo build funciona no navegador e no app desktop (file://).
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    // Saídas de build não devem ser observadas (arquivos grandes, travados pelo OneDrive/antivírus).
    watch: { ignored: ['**/release/**', '**/desktop-app/**', '**/dist/**'] },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});

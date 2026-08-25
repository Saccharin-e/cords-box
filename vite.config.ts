/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@graph': resolve(__dirname, 'src/graph'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@store': resolve(__dirname, 'src/store'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@presets': resolve(__dirname, 'src/presets'),
      '@lint': resolve(__dirname, 'src/lint'),
      '@tutorials': resolve(__dirname, 'src/tutorials'),
      '@docs': resolve(__dirname, 'src/docs'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});

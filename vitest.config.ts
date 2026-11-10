import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/(.*)/,
        replacement: '$1',
        customResolver(source) {
          const rootPath = path.resolve(__dirname, source);
          if (
            fs.existsSync(rootPath) ||
            fs.existsSync(rootPath + '.ts') ||
            fs.existsSync(rootPath + '.tsx') ||
            fs.existsSync(rootPath + '.js')
          ) {
            return rootPath;
          }
          return path.resolve(__dirname, 'src', source);
        },
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
});

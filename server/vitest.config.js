import { defineConfig } from 'vitest/config';

// Server chạy Node thuần, không cần jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.js']
  }
});

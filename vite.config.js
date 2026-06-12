import { defineConfig } from 'vite';

// Relative base so the build works on GitLab Pages or any sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2020' }
});

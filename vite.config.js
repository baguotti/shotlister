import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://shotlister.vercel.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});

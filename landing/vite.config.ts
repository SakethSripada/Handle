import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Handle/',
  plugins: [react()],
  server: { port: 5199, host: '127.0.0.1' },
});

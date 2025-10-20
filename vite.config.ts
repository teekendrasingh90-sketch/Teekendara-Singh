import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For deployment on Netlify, create an environment variable in the Netlify UI named
// VITE_API_KEY with your Gemini API key. Vite will replace `process.env.API_KEY`
// in the code with this value during the build process.
// Read more: https://vitejs.dev/guide/env-and-mode.html

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY),
  },
});

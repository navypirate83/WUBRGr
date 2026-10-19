// Settings for Vite, the tool that runs the app while you work on it
// ("npm run dev") and builds the finished website ("npm run build").
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin lets Vite understand JSX (the HTML-like code inside
  // the .tsx files) and refreshes the page instantly when you save a file.
  plugins: [react()],

  // GitHub Pages puts the site at navypirate83.github.io/WUBRGr/, not at
  // the root of the address, so every link and file path starts with
  // "/WUBRGr/". (The same is used while working locally, so they match.)
  base: '/WUBRGr/',

  // While working locally, the app runs at http://localhost:3000/WUBRGr/
  server: { port: 3000 },
});

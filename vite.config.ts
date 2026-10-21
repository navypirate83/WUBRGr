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

  // Building the finished site: the libraries the app uses (React, React
  // Router, TanStack Query, dnd-kit: everything from "node_modules") go
  // into a file of their own, "vendor-....js", separate from the app's
  // own code. Both still load straight away, but each file stays a sensible
  // size, and since the libraries change far less often than the app,
  // browsers (and the installed app's saved copy) can keep that file
  // between updates instead of downloading it again.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
});

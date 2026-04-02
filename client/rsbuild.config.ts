import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  server: {
    port: 3000,
    historyApiFallback: true,
    proxy: {
      '/api': 'http://localhost:6423',
      '/ws': {
        target: 'http://localhost:6423',
        ws: true,
      },
    },
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
        ],
      },
    },
  },
  html: {
    title: 'Raider',
    favicon: '',
  },
});

import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    dts({
      tsconfigPath: './tsconfig.lib.json',
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'graphql-infinite-query',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      // Externalize every peer dep AND lodash-es so none of them are
      // bundled into the output. Consumers provide them from their own
      // node_modules (peer deps) or npm installs them alongside this
      // package (lodash-es, a regular dependency).
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@apollo/client',
        'graphql',
        'lodash-es',
        'class-variance-authority',
        'clsx',
        /^lucide-react/,
        /^radix-ui/,
        'tailwind-merge',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
})

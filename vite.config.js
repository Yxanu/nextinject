import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	plugins: [vue()],
	build: {
		cssCodeSplit: false,
		emptyOutDir: false,
		lib: {
			entry: resolve(__dirname, 'src/admin/main.js'),
			formats: ['iife'],
			name: 'NextInjectAdmin',
			fileName: () => 'js/admin.js',
		},
		outDir: '.',
		rollupOptions: {
			output: {
				assetFileNames: (assetInfo) => {
					if (assetInfo.name?.endsWith('.css')) {
						return 'css/admin.css'
					}

					return 'js/[name][extname]'
				},
			},
		},
		target: 'es2018',
	},
})

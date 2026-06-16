import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	// geotiff uses a Web Worker with top-level await; iife format doesn't support that.
	worker: { format: 'es' },
	build: {
		sourcemap: true,
		rollupOptions: {
			onwarn(warning, warn) {
				if (
					warning.code === 'SOURCEMAP_ERROR' ||
					(warning.code === 'MISSING_SOURCE' &&
						warning.message?.includes('@developmentseed/geotiff'))
				) {
					return;
				}
				warn(warning);
			}
		}
	}
});

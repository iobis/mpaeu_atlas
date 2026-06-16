import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: '404.html' }),
		paths: {
			// Set via env var in CI (e.g. BASE_PATH=/mpaeu_atlas for GitHub Pages).
			// Empty string during local dev so relative URLs work without a subpath.
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;

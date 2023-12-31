import { sveltekit } from '@sveltejs/kit/vite';
import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), glsl()],
	ssr: {
		noExternal: ['three', 'three-custom-shader-material']
	}
});

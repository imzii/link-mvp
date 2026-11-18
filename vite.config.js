import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './': GitHub Pages(하위 경로)와 Vercel(루트) 어디에 올려도 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [svelte()],
});

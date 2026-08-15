// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';

export default defineConfig({
	// 上线前只需替换为最终自定义域名，RSS、canonical 与站点地图会同步更新。
	site: 'https://aria-7.pages.dev',
	output: 'static',
	trailingSlash: 'always',
	integrations: [mdx(), sitemap()],
	markdown: {
		processor: unified({ gfm: true }),
		shikiConfig: {
			theme: 'github-light',
			wrap: true,
		},
	},
});

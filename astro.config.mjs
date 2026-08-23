// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { loadEnv } from 'vite';

// 生产域名只保留一个公开入口，避免 canonical、RSS 与 Sitemap 各自漂移。
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const siteUrl = env.PUBLIC_SITE_URL || 'https://aria-7.pages.dev';

export default defineConfig({
	site: siteUrl,
	output: 'static',
	trailingSlash: 'always',
	// 开发工具栏会覆盖页面底部场景，视觉联调与普通本地预览都保持关闭。
	devToolbar: {
		enabled: false,
	},
	integrations: [mdx(), sitemap()],
	markdown: {
		processor: unified({ gfm: true }),
		shikiConfig: {
			// 双主题：浅色值直接写入行内样式，深色值以 --shiki-dark 变量输出，
			// 夜间天气模式下由 typography.css 翻转，无需重刷高亮。
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: 'light',
			wrap: true,
		},
	},
});

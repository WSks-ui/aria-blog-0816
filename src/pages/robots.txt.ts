import type { APIRoute } from 'astro';

import { SITE } from '@/data/site';

export const prerender = true;

/**
 * robots.txt 不是权限控制，而是给搜索引擎爬虫的访问提示。
 * 站点地址从 Astro 的 site 配置读取，部署到 COS 或绑定正式域名后，
 * 只需要设置 PUBLIC_SITE_URL，Sitemap 地址就会随构建自动更新。
 */
export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL(SITE.url);
	const sitemapUrl = new URL('/sitemap-index.xml', siteUrl).toString();

	return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};

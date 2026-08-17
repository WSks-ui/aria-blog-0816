export const POST_KINDS = ['essay', 'note', 'project', 'photo', 'code', 'tutorial'] as const;

export type PostKind = (typeof POST_KINDS)[number];

export const POST_KIND_LABELS = {
	essay: '随笔',
	note: '札记',
	project: '项目',
	photo: '影像',
	code: '代码',
	tutorial: '指南',
} as const satisfies Record<PostKind, string>;

export const SITE = {
	name: 'Aria-7',
	title: 'Aria-7 · 雨线之外',
	description: '记录设计、代码、影像与日常观察的个人博客。',
	locale: 'zh-CN',
	timeZone: 'Asia/Shanghai',
	// 与 astro.config 共用同一个公开环境变量；未配置时保留当前 Pages 预览地址作为开发回退。
	url: import.meta.env.PUBLIC_SITE_URL || 'https://aria-7.pages.dev',
	author: {
		name: 'Aria-7',
		profile: '/about/',
	},
	feedPath: '/rss.xml',
	postsPerPage: 10,
} as const;

export const NAV_ITEMS = [
	{ label: '首页', href: '/' },
	{ label: '文章', href: '/posts/' },
	{ label: '归档', href: '/archive/' },
	{ label: '关于', href: '/about/' },
] as const;

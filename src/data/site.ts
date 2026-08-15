export const POST_KINDS = ['essay', 'note', 'project', 'photo', 'code', 'tutorial'] as const;

export type PostKind = (typeof POST_KINDS)[number];

export const POST_KIND_LABELS = {
	essay: '随笔',
	note: '札记',
	project: '项目',
	photo: '影像',
	code: '代码',
	tutorial: '教程',
} as const satisfies Record<PostKind, string>;

export const SITE = {
	name: 'Aria-7',
	title: 'Aria-7 · 雨线之外',
	description: '记录设计、代码、影像与日常观察的个人博客。',
	locale: 'zh-CN',
	timeZone: 'Asia/Shanghai',
	// 上线前应替换为真实域名；配置 astro.config 的 site 后，RSS 会优先使用构建上下文中的正式地址。
	url: 'https://aria-7.pages.dev',
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

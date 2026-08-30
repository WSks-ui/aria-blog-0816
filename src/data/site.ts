export const POST_KINDS = ['essay', 'note', 'project', 'photo', 'code', 'tutorial'] as const;

export type PostKind = (typeof POST_KINDS)[number];

/*
 * 栏目文案的唯一出处。label 是元信息行与搜索结果里的短名；longLabel 是
 * 栏目标签（KindLabel）与 RSS 分类用的全名；code 是 HUD 风格的英文代号。
 * 各处不得再自备同义表，避免「札记/笔记/学习笔记」各说各话。
 */
export const POST_KIND_META = {
	essay: { label: '随笔', longLabel: '随笔', code: 'ESSAY' },
	note: { label: '札记', longLabel: '学习笔记', code: 'NOTE' },
	project: { label: '项目', longLabel: '项目', code: 'PROJECT' },
	photo: { label: '影像', longLabel: '摄影与插画', code: 'FRAME' },
	code: { label: '代码', longLabel: '代码笔记', code: 'CODE' },
	tutorial: { label: '指南', longLabel: '指南', code: 'GUIDE' },
} as const satisfies Record<PostKind, { label: string; longLabel: string; code: string }>;

export const POST_KIND_LABELS = {
	essay: '随笔',
	note: '札记',
	project: '项目',
	photo: '影像',
	code: '代码',
	tutorial: '指南',
} as const satisfies Record<PostKind, string>;

/** 首页六轨索引的轨道参数：桌面轨道高度百分比与档案场景码。按 kind 键控，避免数组下标错位。 */
export const POST_KIND_TRACKS = {
	essay: { height: 58, code: POST_KIND_META.essay.code },
	note: { height: 82, code: POST_KIND_META.note.code },
	project: { height: 68, code: POST_KIND_META.project.code },
	photo: { height: 94, code: POST_KIND_META.photo.code },
	code: { height: 74, code: POST_KIND_META.code.code },
	tutorial: { height: 86, code: POST_KIND_META.tutorial.code },
} as const satisfies Record<PostKind, { height: number; code: string }>;

/*
 * 页头导航与文章侧轨共用的栏目数组（SiteHeader / ArticleLayout 各挂一份
 * 同一引用）。文案刻意用「笔记/底片」这一套导航说法，与栏目标签区分。
 */
export const SECTION_NAV_ITEMS = [
	{ href: '/types/essay/', label: '随笔' },
	{ href: '/types/note/', label: '笔记' },
	{ href: '/types/project/', label: '项目' },
	{ href: '/types/photo/', label: '底片' },
	{ href: '/types/code/', label: '代码' },
	{ href: '/types/tutorial/', label: '指南' },
	{ href: '/archive/', label: '归档' },
] as const;

export const SITE = {
	name: 'Aria-7',
	title: 'Aria-7 · 雨线之外',
	description: '记录设计、代码、影像与日常观察的个人博客。',
	locale: 'zh-CN',
	// 与 astro.config 共用同一个公开环境变量；未配置时保留当前 Pages 预览地址作为开发回退。
	url: import.meta.env.PUBLIC_SITE_URL || 'https://aria-7.pages.dev',
	feedPath: '/rss.xml',
} as const;

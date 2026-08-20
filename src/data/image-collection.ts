import type { ImageMetadata } from 'astro';

import skylineFull from '../assets/images/collection/skyline-full.webp';
import skylineThumb from '../assets/images/collection/skyline-thumb.webp';
import rainUmbrellaFull from '../assets/images/collection/rain-umbrella-full.webp';
import rainUmbrellaThumb from '../assets/images/collection/rain-umbrella-thumb.webp';
import butterfliesFull from '../assets/images/collection/butterflies-full.webp';
import butterfliesThumb from '../assets/images/collection/butterflies-thumb.webp';
import forestFireFull from '../assets/images/collection/forest-fire-full.webp';
import forestFireThumb from '../assets/images/collection/forest-fire-thumb.webp';
import gardenFull from '../assets/images/collection/garden-full.webp';
import gardenThumb from '../assets/images/collection/garden-thumb.webp';
import rainTrainFull from '../assets/images/collection/rain-train-full.webp';
import rainTrainThumb from '../assets/images/collection/rain-train-thumb.webp';
import purpleLetterFull from '../assets/images/collection/purple-letter-full.webp';
import purpleLetterThumb from '../assets/images/collection/purple-letter-thumb.webp';
import missSilverFull from '../assets/images/collection/miss-silver-full.webp';
import missSilverThumb from '../assets/images/collection/miss-silver-thumb.webp';
import missVioletFull from '../assets/images/collection/miss-violet-full.webp';
import missVioletThumb from '../assets/images/collection/miss-violet-thumb.webp';
import missBlueFull from '../assets/images/collection/miss-blue-full.webp';
import missBlueThumb from '../assets/images/collection/miss-blue-thumb.webp';
import missSepiaFull from '../assets/images/collection/miss-sepia-full.webp';
import missSepiaThumb from '../assets/images/collection/miss-sepia-thumb.webp';

export interface ImageCollectionItem {
	id: string;
	title: string;
	src: ImageMetadata;
	thumbnail: ImageMetadata;
	alt: string;
	description: string;
	credit: string;
	width: number;
	height: number;
	accent: string;
	size: 'feature' | 'wide' | 'standard' | 'portrait';
}

const ONLINE_SOURCE_NOTICE = '来自互联网，如侵权请联系';

/**
 * 图片收藏按浏览时的情绪顺序编排，不代表作品创作时间。
 * 收藏来自互联网，尚未逐项核验作者与原始出处，因此统一展示侵权联系提示。
 */
export const IMAGE_COLLECTION: readonly ImageCollectionItem[] = [
	{
		id: 'skyline-white-dress',
		title: '云层与天台',
		src: skylineFull,
		thumbnail: skylineThumb,
		alt: '蓝天下的城市天台，一位穿白裙的黑发少女倚在栏杆旁',
		description: '高亮云层、深蓝建筑与白色衣裙形成安静而开阔的夏日画面。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1672,
		height: 941,
		accent: '#55b8d5',
		size: 'feature',
	},
	{
		id: 'rain-umbrella',
		title: '透明伞下',
		src: rainUmbrellaFull,
		thumbnail: rainUmbrellaThumb,
		alt: '雨天透明伞下的黑发少女，背景叠合灰紫色城市街景',
		description: '颗粒、重影和雨伞骨架叠在一起，像一张受潮的旧底片。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1609,
		height: 2400,
		accent: '#a49cc8',
		size: 'portrait',
	},
	{
		id: 'frieren-butterflies',
		title: '蝶群入夜',
		src: butterfliesFull,
		thumbnail: butterfliesThumb,
		alt: '深蓝暮色与橙色蝶群中，花束旁的人物倒映在水面上',
		description: '冷色长夜被橙色蝶群切开，倒影让画面形成上下两层叙事。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 3200,
		height: 1652,
		accent: '#e7964b',
		size: 'wide',
	},
	{
		id: 'frieren-fire',
		title: '林间火光',
		src: forestFireFull,
		thumbnail: forestFireThumb,
		alt: '深蓝森林中，两位人物并肩坐在明亮的篝火旁',
		description: '近黑森林包围暖色火焰，视觉焦点压在画面右下区域。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 3000,
		height: 1308,
		accent: '#f08a50',
		size: 'wide',
	},
	{
		id: 'kita-garden',
		title: '花园午后',
		src: gardenFull,
		thumbnail: gardenThumb,
		alt: '明暗交界的繁茂花园和旧建筑旁，一位红发人物坐在窗边',
		description: '荧亮植物与深色建筑形成强烈明暗分区，红色花叶贯穿中心。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 3200,
		height: 2023,
		accent: '#e45d4f',
		size: 'feature',
	},
	{
		id: 'mygo-train',
		title: '雨色列车',
		src: rainTrainFull,
		thumbnail: rainTrainThumb,
		alt: '雨色列车内并坐的少女们，车窗覆盖彩色涂鸦与水滴',
		description: '低饱和青绿色车厢、玻璃反射和水滴共同构成潮湿的群像。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 3200,
		height: 1653,
		accent: '#78c6bd',
		size: 'wide',
	},
	{
		id: 'purple-letter',
		title: '紫藤来信',
		src: purpleLetterFull,
		thumbnail: purpleLetterThumb,
		alt: '紫色长发的少女微笑着拿起一封带有心形封口的信',
		description: '铅笔般的紫色线稿与大片留白，让画面保留轻柔的纸张感。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1260,
		height: 885,
		accent: '#9276cc',
		size: 'standard',
	},
	{
		id: 'miss-silver',
		title: 'Miss You / Silver',
		src: missSilverFull,
		thumbnail: missSilverThumb,
		alt: '银白长发少女的灰色调半身插画，左侧写有 I miss you',
		description: '近单色背景和轻微肤色把视线集中到眼睛与手写文字。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1260,
		height: 707,
		accent: '#a9bdd0',
		size: 'standard',
	},
	{
		id: 'miss-violet',
		title: 'Miss You / Violet',
		src: missVioletFull,
		thumbnail: missVioletThumb,
		alt: '紫色短发少女穿着粉色外套，左侧写有 I miss you',
		description: '柔和粉紫渐变和右侧人物构成一张简洁的情绪海报。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1260,
		height: 751,
		accent: '#b987a8',
		size: 'standard',
	},
	{
		id: 'miss-blue',
		title: 'Miss You / Blue',
		src: missBlueFull,
		thumbnail: missBlueThumb,
		alt: '蓝灰色短发少女把发梢捧在脸前，左侧写有 I miss you',
		description: '平涂蓝色背景把人物轮廓和白色手写字衬得格外清楚。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1252,
		height: 704,
		accent: '#73a7df',
		size: 'standard',
	},
	{
		id: 'miss-sepia',
		title: 'Miss You / Sepia',
		src: missSepiaFull,
		thumbnail: missSepiaThumb,
		alt: '棕色长发少女双手靠近脸侧，左侧写有 I miss you',
		description: '白底与浅棕线条形成克制、接近旧信纸的低对比画面。',
		credit: ONLINE_SOURCE_NOTICE,
		width: 1260,
		height: 698,
		accent: '#c69c86',
		size: 'standard',
	},
];


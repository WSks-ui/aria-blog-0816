/*
 * 天气主题的单一事实来源。页头控件（WeatherModeControl）与文章侧轨
 * （ArticleLayout）此前各自复制了一份提交动作，已经出现过「rail 版漏
 * 维护 activeMode」的漂移——改主题语义只允许改这里。
 */
export type WeatherMode = 'clear' | 'rain' | 'night';

export const WEATHER_MODES: readonly WeatherMode[] = ['clear', 'rain', 'night'];

export const WEATHER_MODE_STORAGE_KEY = 'aria7-weather-mode';

export function isWeatherMode(value: string | null | undefined): value is WeatherMode {
	return typeof value === 'string' && (WEATHER_MODES as readonly string[]).includes(value);
}

/** 三档主题各自的地址栏色：与根节点底材同步，切换时浏览器边缘不会闪出旧色板。 */
const THEME_COLORS: Record<WeatherMode, string> = {
	clear: '#f6f7f3',
	rain: '#ebedec',
	night: '#0d1216',
};

export interface CommitWeatherModeOptions {
	/** 传入则把选择写入 localStorage 这个键；缺省只在本页生效。 */
	storageKey?: string;
	/** 事件来源：控件手动切换用 'control'，恢复/初始化等程序路径用 'system'。 */
	source?: 'control' | 'system';
	/** 页面初次应用的标记，透传给 weather-mode-change。 */
	initial?: boolean;
}

/**
 * 提交一档天气：根属性、地址栏 theme-color、页头单选组同步、可选落盘、
 * 广播 weather-mode-change。previousMode 在写入前读取。
 */
export function commitWeatherMode(mode: WeatherMode, options: CommitWeatherModeOptions = {}) {
	const previousMode = isWeatherMode(document.documentElement.dataset.weatherMode)
		? (document.documentElement.dataset.weatherMode as WeatherMode)
		: null;
	document.documentElement.dataset.weatherMode = mode;
	document.documentElement.dataset.theme = mode === 'night' ? 'night' : 'light';
	document.documentElement.style.colorScheme = mode === 'night' ? 'dark' : 'light';
	const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
	if (themeColor) {
		themeColor.content = THEME_COLORS[mode];
	}

	// 页头单选组是另一组件的 DOM：跨组件同步它的选中态，避免两处显示分叉。
	// 单选组使用漫游 tabindex：只有选中项保留在 Tab 序，其余靠方向键到达。
	document.querySelectorAll<HTMLElement>('[data-weather-mode-value]').forEach((control) => {
		const selected = control.dataset.weatherModeValue === mode;
		control.setAttribute('aria-checked', String(selected));
		control.tabIndex = selected ? 0 : -1;
		control.dataset.active = String(selected);
	});

	document.querySelectorAll<HTMLElement>('[data-weather-theme-label]').forEach((label) => {
		label.textContent = `THEME / ${mode.toUpperCase()}`;
		label.dataset.weatherMode = mode;
	});

	if (options.storageKey) {
		try {
			localStorage.setItem(options.storageKey, mode);
		} catch {
			// 隐私模式可能禁用存储；主题仍在当前页面立即生效。
		}
	}

	document.dispatchEvent(
		new CustomEvent('weather-mode-change', {
			detail: {
				mode,
				previousMode,
				source: options.source ?? 'system',
				initial: options.initial ?? false,
			},
		}),
	);
}

export function readStoredWeatherMode(storageKey: string): WeatherMode | null {
	try {
		const value = localStorage.getItem(storageKey);
		return isWeatherMode(value) ? value : null;
	} catch {
		return null;
	}
}

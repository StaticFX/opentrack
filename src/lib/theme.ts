// Client-side theme preference. The stored value is 'light' | 'dark' | 'system'
// ('system' is represented by the absence of the localStorage key). The
// resolved theme ('light' | 'dark') is mirrored onto <html data-theme> — the
// same attribute the pre-paint script in app.html sets — which drives every
// `dark:` utility and the design tokens in app.css.

export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'ot-theme';

export function getThemePref(): ThemePref {
	if (typeof localStorage === 'undefined') return 'system';
	const v = localStorage.getItem(KEY);
	return v === 'light' || v === 'dark' ? v : 'system';
}

function systemPrefersDark(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
	return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

/** Reflect the given preference onto <html data-theme>. */
export function applyTheme(pref: ThemePref): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = resolveTheme(pref);
}

/** Persist the preference and apply it immediately. */
export function setThemePref(pref: ThemePref): void {
	try {
		if (pref === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, pref);
	} catch {
		/* storage may be unavailable (private mode) — still apply for this session */
	}
	applyTheme(pref);
}

/** Keep 'system' preference in sync with OS changes. Returns a cleanup fn. */
export function watchSystemTheme(): () => void {
	if (typeof matchMedia === 'undefined') return () => {};
	const mq = matchMedia('(prefers-color-scheme: dark)');
	const onChange = () => {
		if (getThemePref() === 'system') applyTheme('system');
	};
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
}

// Remembered per browser, so /preview's intro dialog opens by itself only
// on the first visit (it can still be reopened with I at any time).
// Storage can be unavailable (private windows, blocked site data) — then it
// just shows on every visit instead of breaking the page.
const STORAGE_KEY = 'globe:preview-intro-seen';

export function hasSeenIntro() {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

export function markIntroSeen() {
	try {
		window.localStorage.setItem(STORAGE_KEY, '1');
	} catch {
		// Ignore — see STORAGE_KEY.
	}
}

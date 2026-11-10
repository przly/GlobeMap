import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Kbd } from './Kbd';

// Remembered per browser, so the intro shows only on the first visit.
// Storage can be unavailable (private windows, blocked site data) — then it
// just shows on every visit instead of breaking the page.
const STORAGE_KEY = 'globe:preview-intro-seen';

function hasSeenIntro() {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

function markIntroSeen() {
	try {
		window.localStorage.setItem(STORAGE_KEY, '1');
	} catch {
		// Ignore — see STORAGE_KEY.
	}
}

// First-visit instructions for /preview's pins panel. A native modal
// <dialog> so focus is trapped inside it and the page behind is inert
// while it's open; Escape dismisses it the same as the button does.
export function PreviewIntroDialog() {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [isOpen] = useState(() => !hasSeenIntro());

	useEffect(() => {
		// The .open check matters under StrictMode's double effect run:
		// showModal() on an already-open dialog throws.
		const dialog = dialogRef.current;
		if (isOpen && dialog && !dialog.open) dialog.showModal();
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<dialog
			ref={dialogRef}
			onClose={markIntroSeen}
			aria-labelledby="preview-intro-title"
			className="m-auto w-[min(400px,calc(100vw-32px))] rounded-[24px] border-[0.5px] border-[#e6eaed] bg-white p-6 text-[#041c2c] shadow-lg backdrop:bg-[#041c2c]/30 backdrop:backdrop-blur-[2px]"
		>
			<h2
				id="preview-intro-title"
				className="font-['Inter'] text-[20px] leading-[1.2] font-medium tracking-[-0.4px]"
			>
				Adding your own pins
			</h2>

			<ol className="mt-4 flex flex-col gap-3 font-['Inter'] text-sm leading-[1.5] text-[#42515d]">
				<Step n={1}>
					In the <strong className="font-medium text-[#041c2c]">Pins</strong> panel, switch from
					Existing to <strong className="font-medium text-[#041c2c]">Custom</strong>, or to{' '}
					<strong className="font-medium text-[#041c2c]">None</strong> for a globe without pins.
				</Step>
				<Step n={2}>
					Enter a name, latitude and longitude. The pin shows on the globe once all three are filled
					in.
				</Step>
				<Step n={3}>
					Use <strong className="font-medium text-[#041c2c]">Add pin</strong> for more rows, and ×
					to remove one.
				</Step>
				<Step n={4}>
					Press <Kbd>H</Kbd> to hide or show the panel. If you're typing in a field, press{' '}
					<Kbd>Esc</Kbd> first.
				</Step>
			</ol>

			<form method="dialog" className="mt-6">
				<button
					// autoFocus lands focus on the button rather than nothing, so
					// Enter/Space dismisses straight away.
					autoFocus
					className="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-[32px] border border-[#82e472] bg-[#44d62c] font-['Inter'] text-sm font-medium text-[#041c2c] transition-all duration-80 outline-none hover:bg-[#3bc224] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:scale-98"
				>
					I understood
				</button>
			</form>
		</dialog>
	);
}

function Step({ n, children }: { n: number; children: ReactNode }) {
	return (
		<li className="flex gap-3">
			<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4f6f7] font-mono text-xs text-[#041c2c] tabular-nums">
				{n}
			</span>
			<span className="pt-0.5">{children}</span>
		</li>
	);
}

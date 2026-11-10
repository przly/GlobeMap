import { useEffect, useRef, type ReactNode } from 'react';
import { markIntroSeen } from '../lib/previewIntro';
import { Kbd } from './Kbd';

// Instructions for /preview's pins panel: opens by itself on the first
// visit and again whenever I is pressed (open state lives in PreviewPage).
// A native modal <dialog> so focus is trapped inside it and the page behind
// is inert while it's open; Escape dismisses it the same as the button does.
export function PreviewIntroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		// The .open checks matter under StrictMode's double effect run:
		// showModal() on an already-open dialog throws.
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={dialogRef}
			onClose={() => {
				markIntroSeen();
				onClose();
			}}
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
					<strong className="font-medium text-[#041c2c]">None</strong> to hide all the location
					pins.
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
				<Step n={5}>
					Press <Kbd>I</Kbd> at any time to open these instructions again.
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

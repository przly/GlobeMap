import type { ReactNode } from 'react';

// Gray keycap for keyboard shortcuts in /preview's intro dialog and panel.
export function Kbd({ children }: { children: ReactNode }) {
	return (
		<kbd className="inline-flex min-w-6 items-center justify-center rounded-[6px] border border-[#e6eaed] bg-[#f4f6f7] px-1.5 font-mono text-xs leading-5 text-[#041c2c]">
			{children}
		</kbd>
	);
}

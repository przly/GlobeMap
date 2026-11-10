import { useEffect, useRef, useState } from 'react';
import { Globe, type GlobeMarker, type GlobeMarkerTooltipContext } from './components/globe';
import { Kbd } from './components/Kbd';
import { PinsPanel } from './components/PinsPanel';
import { PreviewIntroDialog } from './components/PreviewIntroDialog';
import { cn } from './lib/cn';
import { LABEL_STYLE } from './lib/controlStyles';
import { usePinsEditor, type PinsEditor } from './lib/pinsEditor';
import { locations } from './lib/locations';
import { hasSeenIntro } from './lib/previewIntro';

// Bare preview of the root route's globe: same globe, same pins, at exactly
// the on-screen size it has inside App's card — but uncropped, centered in
// the viewport, and with none of the card's chrome or focus/click
// interactions.
//
// GlobeScene draws the sphere with a diameter of 0.8 * scale * canvasHeight
// (its normalized space spans the canvas height, sphere radius 0.8), and it
// only fits uncropped while scale <= 1 / 0.8 on a square canvas. App's card
// uses scale 1.5 (desktop) / 0.6 (mobile) on a canvas as tall as the card,
// so here the canvas is a square of side cardScale * cardHeight rendered at
// scale 1 — the same diameter in pixels, with a 10% margin on each side for
// the pins. Card heights mirror App's <main>: 700px on lg, otherwise a
// 361/674 aspect box spanning the viewport minus its 16px gutters. Keep
// these in sync if App's card size or default scales change.
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
const MARKER_SIZE = 0.06;
const CANVAS_SIZE_CLASS = 'size-[calc((100vw-32px)*674/361*0.6)] lg:size-[calc(700px*1.5)]';

function useIsDesktop() {
	const [isDesktop, setIsDesktop] = useState(() =>
		typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_MEDIA_QUERY).matches
	);

	useEffect(() => {
		const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
		const onChange = () => setIsDesktop(mediaQuery.matches);
		onChange();
		mediaQuery.addEventListener('change', onChange);
		return () => mediaQuery.removeEventListener('change', onChange);
	}, []);

	return isDesktop;
}

const toMarkers = (pins: PinsEditor['pins']): GlobeMarker[] =>
	pins.map(({ label, location }) => ({ location, label, color: '#041c2c', size: MARKER_SIZE }));

// Page shortcuts: H toggles the pins panel, I opens the instructions
// dialog. Bare keys (no modifier) so hiding the panel is one keystroke
// before a screen capture — and so they don't fire while typing a pin name
// containing an "h" or "i", they're ignored whenever a text field has focus
// (Escape leaves the field first).
const TOGGLE_PANEL_KEY = 'h';
const OPEN_INSTRUCTIONS_KEY = 'i';

function isTypingTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

function usePreviewShortcuts({
	onTogglePanel,
	onOpenInstructions
}: {
	onTogglePanel: () => void;
	onOpenInstructions: () => void;
}) {
	// Read through a ref so the listener is attached once, not on every render.
	const handlersRef = useRef({ onTogglePanel, onOpenInstructions });
	useEffect(() => {
		handlersRef.current = { onTogglePanel, onOpenInstructions };
	});

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			// The instructions dialog is modal — leave its keys alone.
			if (document.querySelector('dialog[open]')) return;
			if (event.key === 'Escape' && isTypingTarget(event.target)) {
				(event.target as HTMLElement).blur();
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
			if (isTypingTarget(event.target)) return;
			const key = event.key.toLowerCase();
			if (key === TOGGLE_PANEL_KEY) {
				event.preventDefault();
				handlersRef.current.onTogglePanel();
			} else if (key === OPEN_INSTRUCTIONS_KEY) {
				event.preventDefault();
				handlersRef.current.onOpenInstructions();
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);
}

// Same pill as App's unfocused marker tooltip, minus the hover/press states.
function renderMarkerTooltip({ marker }: GlobeMarkerTooltipContext) {
	return (
		<div className="relative flex shrink-0 items-center gap-2.5 rounded-[9000px] border border-[#e6eaed] bg-white px-2.5 py-2 text-xs leading-none font-medium whitespace-nowrap text-[#041c2c] shadow-lg">
			<span className="size-2 shrink-0 rounded-full bg-[#44d62c]" />
			{marker.label}
		</div>
	);
}

export default function PreviewPage() {
	const isDesktop = useIsDesktop();
	const pinsEditor = usePinsEditor(locations);
	const [isPanelOpen, setIsPanelOpen] = useState(true);
	const [isInstructionsOpen, setIsInstructionsOpen] = useState(() => !hasSeenIntro());
	usePreviewShortcuts({
		onTogglePanel: () => setIsPanelOpen((open) => !open),
		onOpenInstructions: () => setIsInstructionsOpen(true)
	});

	return (
		// The canvas can be wider/taller than the viewport (the globe itself
		// isn't), so the page clips the canvas's empty margin instead of
		// scrolling.
		<div className="fixed inset-0 overflow-hidden bg-white">
			<div className={cn('absolute top-1/2 left-1/2 -translate-1/2', CANVAS_SIZE_CLASS)}>
				<Globe
					className="absolute inset-0 h-full w-full"
					scale={1}
					rotation={5}
					axialTilt={-23}
					pointCount={35000}
					pointSize={0.07}
					landPointColor="#44d62c"
					fresnelConfig={{ color: '#E6EAED', rimColor: '#44D62C' }}
					markers={toMarkers(pinsEditor.pins)}
					markerTooltip={renderMarkerTooltip}
					autoRotate
					lockedPolarAngle={isDesktop}
				/>
			</div>

			{/* Unmounted (not just visually hidden) while closed, so nothing of
			    it is left on screen or in the tab order; its state lives in
			    pinsEditor above, so reopening keeps what was typed. */}
			{isPanelOpen ? (
				<PinsPanel
					editor={pinsEditor}
					className="absolute top-4 left-4 max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] overflow-y-auto lg:top-[36px] lg:left-[36px]"
					footer={
						<span className={cn(LABEL_STYLE, 'text-center')}>
							Press <Kbd>H</Kbd> to hide / show this panel, <Kbd>I</Kbd> for instructions
						</span>
					}
				/>
			) : null}

			<PreviewIntroDialog open={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
		</div>
	);
}

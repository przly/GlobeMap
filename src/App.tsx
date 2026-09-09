import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate } from 'motion';
import { AnimatePresence, motion } from 'motion/react';
import { Globe, type GlobeMarker, type GlobeMarkerTooltipContext } from './components/globe';
import LocationInfoCard from './components/LocationInfoCard';
import { cn } from './lib/cn';
import { locations, isFocused } from './lib/locations';

const DESKTOP_DEFAULT_SCALE = 1.5;
const DESKTOP_FOCUS_SCALE = 3;
const MOBILE_DEFAULT_SCALE = 0.6;
const MOBILE_FOCUS_SCALE = 1.5;

// On mobile the globe's canvas is a fixed size/position (see the Globe
// className below) — it never resizes or moves. The default-vs-focused
// "zoom" is achieved purely by animating `scale` around this fixed anchor,
// so the globe grows/shrinks in place instead of the canvas sliding/resizing.
const MOBILE_OFFSET_Y = -0.3;

// Point count is held fixed across zoom levels, so the lattice's sphere-space
// spacing is fixed too — but a point at fixed sphere-space size projects to
// screen-space size proportional to `scale`, so on-screen spacing between
// dots grows as you zoom in. pointSize is left unscaled (in sphere-space) so
// it grows on-screen at that same rate, keeping the dot-to-gap ratio (and so
// the perceived density) constant across zoom levels. markerSize instead
// shrinks with 1/scale, holding marker pins at a constant on-screen size.
const basePointCount = 35000;
const basePointSize = 0.07;
const baseMarkerSize = 0.06;

// Matches the `lg` breakpoint: the desktop layout overlays a 433px heading
// block and a 244px locations panel side by side inside the globe card, which
// needs roughly 960px+ of width to avoid the two overlapping.
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

// Desktop-only: while a location is focused, the globe pans down so the
// focused marker's rest position (dead-center, pre-offset, since focusing
// rotates the marker to face the camera) lands near the bottom of the globe
// card instead of at vertical center — leaving room above the pin for the
// info card stacked on top of it (see renderMarkerTooltip) without clipping
// against the card's overflow-hidden edge. Measured empirically against the
// pin+card group's actual rendered height.
const DESKTOP_FOCUS_OFFSET_Y = -0.36;

// Desktop-only: while a location is focused, the globe also pans left (a
// smaller offsetX than the default 1/6) so the pin+card group's rest
// position sits further toward the left of the globe card instead of at
// its default, more-right-of-center spot.
const DESKTOP_FOCUS_OFFSET_X = 1 / 6 - 0.1;

// The globe's offsetX is a shader uniform, not a CSS value, so it can't be
// gated behind a Tailwind breakpoint — it needs to be read from JS instead.
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

export default function App() {
	const isDesktop = useIsDesktop();
	const defaultScale = isDesktop ? DESKTOP_DEFAULT_SCALE : MOBILE_DEFAULT_SCALE;
	const focusScale = isDesktop ? DESKTOP_FOCUS_SCALE : MOBILE_FOCUS_SCALE;
	const defaultOffsetX = isDesktop ? 1 / 6 : 0;
	const [offsetX, setOffsetX] = useState(defaultOffsetX);
	const defaultOffsetY = isDesktop ? 0 : MOBILE_OFFSET_Y;
	const [offsetY, setOffsetY] = useState(defaultOffsetY);
	const [scale, setScale] = useState(defaultScale);
	const [focusOn, setFocusOn] = useState<[number, number] | null>(null);
	// Mobile has no pinch gesture, so double-tapping the globe toggles
	// between the default and focus zoom levels instead.
	const [isDoubleTapZoomed, setIsDoubleTapZoomed] = useState(false);

	// isDesktop is only known for certain after mount (SSR/first paint assumes
	// desktop), and can change later from an actual viewport resize. Re-sync
	// `scale` to the new breakpoint's default during render (React's supported
	// pattern for "adjust state when a prop changes") rather than in an
	// effect, but only when not focused, so a resize can't yank the view out
	// from under an active selection.
	const [prevIsDesktop, setPrevIsDesktop] = useState(isDesktop);
	if (isDesktop !== prevIsDesktop) {
		setPrevIsDesktop(isDesktop);
		if (!focusOn) {
			setScale(defaultScale);
			setOffsetX(defaultOffsetX);
			setOffsetY(defaultOffsetY);
		}
	}

	const pointCount = basePointCount;
	const pointSize = basePointSize;
	const markerSize = baseMarkerSize * (defaultScale / scale);

	const scaleAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
	const offsetXAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
	const offsetYAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

	function animateScaleTo(target: number) {
		scaleAnimationRef.current?.stop();
		scaleAnimationRef.current = animate(scale, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => setScale(latest)
		});
	}

	function animateOffsetXTo(target: number) {
		offsetXAnimationRef.current?.stop();
		offsetXAnimationRef.current = animate(offsetX, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => setOffsetX(latest)
		});
	}

	function animateOffsetYTo(target: number) {
		offsetYAnimationRef.current?.stop();
		offsetYAnimationRef.current = animate(offsetY, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => setOffsetY(latest)
		});
	}

	const markers: GlobeMarker[] = locations.map(({ label, location }) => ({
		location,
		label,
		color: '#041c2c',
		size: markerSize
	}));

	// Mobile-only: drives the list <-> card push/pop swap under the globe
	// card (see the JSX below) instead of the marker-tooltip system used on
	// desktop (isDesktop-gated here so the two never both render the card).
	const focusedLocation =
		focusOn && !isDesktop ? locations.find((loc) => isFocused(focusOn, loc.location)) : undefined;

	function selectLocation(location: [number, number]) {
		const nextFocus = isFocused(focusOn, location) ? null : location;
		setFocusOn(nextFocus);
		setIsDoubleTapZoomed(false);
		animateScaleTo(nextFocus ? focusScale : defaultScale);
		if (isDesktop) {
			animateOffsetXTo(nextFocus ? DESKTOP_FOCUS_OFFSET_X : defaultOffsetX);
			animateOffsetYTo(nextFocus ? DESKTOP_FOCUS_OFFSET_Y : defaultOffsetY);
		}
	}

	function deselectLocation() {
		if (!focusOn) return;
		setFocusOn(null);
		setIsDoubleTapZoomed(false);
		animateScaleTo(defaultScale);
		if (isDesktop) {
			animateOffsetXTo(defaultOffsetX);
			animateOffsetYTo(defaultOffsetY);
		}
	}

	// Mobile-only (see the Globe element below): double-tapping empty globe
	// background toggles in and out of the focus zoom level, since there's
	// no pinch gesture to zoom with.
	function toggleDoubleTapZoom() {
		if (focusOn) return;
		const zoomed = !isDoubleTapZoomed;
		setIsDoubleTapZoomed(zoomed);
		animateScaleTo(zoomed ? focusScale : defaultScale);
	}

	function renderMarkerTooltip({ marker }: GlobeMarkerTooltipContext) {
		const focused = isFocused(focusOn, marker.location);
		// On mobile the info card renders in its own block under the globe
		// card (see the bottom of the JSX below) instead of floating over the
		// canvas anchored to the marker — the mobile canvas is too small for a
		// pin-anchored card to reliably avoid clipping. The pin itself still
		// renders here either way.
		const detail =
			focused && isDesktop ? locations.find((loc) => isFocused(marker.location, loc.location)) : undefined;

		// Always the same flex-column shape, with the pin always last — only
		// whether the card sibling exists changes. Keeping the pin's position
		// in the tree stable (rather than sometimes returning it as the sole
		// root and sometimes nesting it under a new wrapper) keeps it the same
		// DOM node across a focus toggle in both directions, which is what
		// lets its light/dark CSS transition actually animate: React reuses
		// the node and diffs its class in place instead of unmounting the old
		// one and mounting a fresh, un-animatable one in the new position.
		return (
			<div className="flex flex-col items-center gap-4">
				{/* mode="wait" so switching directly between two focused locations
				    fully exits the old card before the new one enters, instead of
				    both briefly sharing this flex column's layout space. */}
				<AnimatePresence mode="wait">
					{detail ? <LocationInfoCard key={detail.label} location={detail} /> : null}
				</AnimatePresence>
				<div
					className={cn(
						'relative flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[9000px] border px-2.5 py-2 text-xs leading-none font-medium whitespace-nowrap shadow-lg transition-[background-color,color,border-color,box-shadow,transform] duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.18)]',
						focused
							? 'border-[#42515d] bg-[#041c2c] text-white'
							: 'border-[#e6eaed] bg-white text-[#041c2c] hover:bg-[#f4f6f7]'
					)}
				>
					<span className="size-2 shrink-0 rounded-full bg-[#44d62c]" />
					{marker.label}
				</div>
			</div>
		);
	}

	// Same press-down convention as GlobeMarkerItem's tooltip: respond on
	// pointer-down (not release) with an instant scale-in. Unlike the tooltip,
	// the release isn't momentum-driven, so it eases back out critically
	// damped (no overshoot) rather than using the bouncier easing token.
	function pressRow(event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) {
		const el = event.currentTarget;
		el.style.transitionTimingFunction = 'var(--avatar-ease-in)';
		el.style.setProperty('--scale-active', 'var(--avatar-press-scale)');
	}

	function releaseRow(event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) {
		const el = event.currentTarget;
		el.style.transitionTimingFunction = 'var(--avatar-ease-in)';
		el.style.removeProperty('--scale-active');
	}

	function renderLocationRows() {
		return locations.map((loc) => {
			const focused = isFocused(focusOn, loc.location);
			return (
				<button
					key={loc.label}
					type="button"
					onClick={() => selectLocation(loc.location)}
					onPointerDown={pressRow}
					onPointerUp={releaseRow}
					onPointerLeave={releaseRow}
					onKeyDown={(event) => {
						if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) pressRow(event);
					}}
					onKeyUp={(event) => {
						if (event.key === 'Enter' || event.key === ' ') releaseRow(event);
					}}
					className="t-avatar group relative w-full shrink-0 overflow-hidden rounded-full"
				>
					{focused ? (
						<span className="absolute inset-0 rounded-full bg-[#041c2c]" />
					) : (
						<span className="absolute inset-0 -translate-x-full rounded-full bg-[#f4f6f7] transition-transform duration-200 ease-out group-hover:translate-x-0" />
					)}
					<span
						className={`relative block px-[20px] py-[12px] text-left font-['Inter'] text-[14px] leading-[1.5] font-normal transition-colors duration-200 ease-out ${
							focused ? 'text-white' : 'text-[#7c868e] group-hover:text-[#041c2c]'
						}`}
					>
						{loc.label}
					</span>
				</button>
			);
		});
	}

	return (
		<div className="flex min-h-screen w-full flex-col items-center gap-4 bg-white px-4 py-6 lg:justify-center lg:px-6">
			<main className="relative flex aspect-[361/674] h-auto w-full shrink-0 items-center justify-center overflow-hidden rounded-[48px] border-[0.5px] border-[#cbd1d6] bg-white lg:aspect-auto lg:h-[700px]">
				<Globe
					className={cn(
						'absolute top-0 left-[-15%] h-full w-[130%]',
						'lg:inset-0 lg:top-auto lg:left-auto lg:h-full lg:w-full'
					)}
					scale={scale}
					offsetX={offsetX}
					offsetY={offsetY}
					rotation={5}
					axialTilt={-23}
					pointCount={pointCount}
					pointSize={pointSize}
					landPointColor="#44d62c"
					fresnelConfig={{ color: '#E6EAED', rimColor: '#44D62C' }}
					markers={markers}
					markerTooltip={renderMarkerTooltip}
					onMarkerClick={(marker) => selectLocation(marker.location)}
					onBackgroundClick={deselectLocation}
					onDoubleTap={isDesktop ? undefined : toggleDoubleTapZoom}
					focusOn={focusOn}
					autoRotate={!focusOn}
					lockedPolarAngle={isDesktop ? !focusOn : false}
				/>

				<div className="absolute top-[47.5px] left-[47.5px] hidden items-center gap-[48px] lg:flex">
					<span className="size-[10px] shrink-0 rounded-full bg-[#44d62c]" />
					<span className="font-mono text-[12px] leading-[1.05] font-medium text-[#7c868e] uppercase">
						locations
					</span>
				</div>

				<div className="absolute bottom-[47.5px] left-[47.5px] hidden w-[433px] flex-col gap-[16px] lg:flex">
					<p className="font-['Inter'] text-[48px] leading-[1.05] font-medium tracking-[-1.44px] text-[#041c2c]">
						Built across Europe, <span className="text-[#7c868e]">with local partners.</span>
					</p>
					<p className="font-['Inter'] text-[16px] leading-[1.5] font-normal text-[#7c868e]">
						See where NGEN operates and find relevant projects, offices and partners near you.
					</p>
				</div>

				<div className="absolute right-[12.5px] bottom-[12.5px] hidden w-[244px] flex-col gap-[2px] overflow-hidden rounded-[36px] border-[0.5px] border-[#e6eaed] bg-white p-[11.5px] lg:flex">
					{renderLocationRows()}
				</div>

				<div className="pointer-events-none absolute top-8 left-8 flex w-[calc(100%-64px)] flex-col items-start gap-4 lg:hidden">
					<p className="font-['Inter'] text-[36px] leading-none font-medium tracking-[-0.72px] text-[#041c2c]">
						<span className="leading-none">Built across Europe, </span>
						<span className="leading-none text-[#7c868e]">with local partners.</span>
					</p>
					<p className="font-['Inter'] text-[16px] leading-[1.5] font-medium text-[#7c868e]">
						See where NGEN operates and find relevant projects, offices and partners near you.
					</p>
					<button
						type="button"
						className="pointer-events-auto inline-flex shrink-0 items-center gap-2 rounded-[9000px] border border-[#42515d] bg-[#041c2c] px-4 py-3 text-sm font-normal text-white"
					>
						About NGEN
						<span aria-hidden="true" className="text-sm leading-none">
							→
						</span>
					</button>
				</div>
			</main>

			{/* overflow-hidden clips the slide so it never causes horizontal page
			    overflow; initial={false} on AnimatePresence means the list just
			    appears normally on first load instead of sliding in from the
			    left as if it had just "come back" from a card. */}
			<div className="w-full overflow-hidden lg:hidden">
				<AnimatePresence mode="wait" initial={false}>
					{focusedLocation ? (
						<motion.div
							key="card"
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
						>
							<LocationInfoCard location={focusedLocation} onBack={deselectLocation} />
						</motion.div>
					) : (
						<motion.div
							key="list"
							initial={{ x: '-100%' }}
							animate={{ x: 0 }}
							exit={{ x: '-100%' }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="flex w-full flex-col gap-[2px] overflow-hidden rounded-[36px] border-[0.5px] border-[#e6eaed] bg-white p-[11.5px]"
						>
							{renderLocationRows()}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

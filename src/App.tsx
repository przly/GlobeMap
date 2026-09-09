import {
	startTransition,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type PointerEvent
} from 'react';
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

// Mobile-only: the globe card steps through three full-size views — globe,
// locations list, and a focused location's card — stacked with absolute
// inset-0 and crossfaded with a small ±32px nudge + opacity (see
// mobileStep/mobileStepDirection below), not a full-width slide. The globe
// view stays mounted at all times so the
// WebGL canvas is never torn down/rebuilt by the swap; list and card
// mount/unmount via AnimatePresence since they're cheap to recreate.
type MobileStep = 'globe' | 'list' | 'card';
const MOBILE_STEP_ORDER: Record<MobileStep, number> = { globe: 0, list: 1, card: 2 };
const MOBILE_PANE_TRANSITION = { duration: 0.14, ease: 'easeInOut' } as const;

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

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
		typeof window === 'undefined' ? false : window.matchMedia(REDUCED_MOTION_QUERY).matches
	);

	useEffect(() => {
		const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
		const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
		onChange();
		mediaQuery.addEventListener('change', onChange);
		return () => mediaQuery.removeEventListener('change', onChange);
	}, []);

	return prefersReducedMotion;
}

export default function App() {
	const isDesktop = useIsDesktop();
	const prefersReducedMotion = usePrefersReducedMotion();
	// Mobile-only: whether the card has left the globe view at all — combined
	// with focusOn below to derive `mobileStep` (globe/list/card). "Explore
	// locations" opens it (landing on the list); its own Back control closes
	// it again, sliding the globe view back into view.
	const [isMobileLocationsOpen, setIsMobileLocationsOpen] = useState(false);

	function openMobileLocations() {
		setIsMobileLocationsOpen(true);
	}

	function closeMobileLocations() {
		deselectLocation();
		setIsMobileLocationsOpen(false);
	}
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
		// A resize onto the desktop breakpoint while mid-way through
		// globe→list→card would otherwise leave the globe pane's -32px,
		// opacity-0 "inactive" state in place (see mobileStep below), hiding
		// the globe on desktop, since that state isn't itself breakpoint-gated.
		if (isDesktop) setIsMobileLocationsOpen(false);
	}

	const pointCount = basePointCount;
	const pointSize = basePointSize;
	const markerSize = baseMarkerSize * (defaultScale / scale);

	const scaleAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
	const offsetXAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
	const offsetYAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

	// These onUpdate callbacks fire every animation frame for up to 0.5s, each
	// forcing a full App re-render — that's already the cost of driving the
	// globe's zoom through React state rather than a ref, but marking the
	// update as a transition lets React deprioritize it behind more urgent
	// work (a click handler, the next paint) instead of blocking the main
	// thread every frame. That's what was dropping frames on transitions that
	// start while a zoom tween from the previous step is still finishing —
	// e.g. tapping "Back to map" while the deselect-triggered zoom-out from
	// leaving the card is still running.
	function animateScaleTo(target: number) {
		scaleAnimationRef.current?.stop();
		scaleAnimationRef.current = animate(scale, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => startTransition(() => setScale(latest))
		});
	}

	function animateOffsetXTo(target: number) {
		offsetXAnimationRef.current?.stop();
		offsetXAnimationRef.current = animate(offsetX, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => startTransition(() => setOffsetX(latest))
		});
	}

	function animateOffsetYTo(target: number) {
		offsetYAnimationRef.current?.stop();
		offsetYAnimationRef.current = animate(offsetY, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => startTransition(() => setOffsetY(latest))
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

	// Mobile-only: the current step in the globe→list→card sequence, derived
	// from isMobileLocationsOpen + focusedLocation rather than tracked
	// directly, so the two can never disagree about what's showing.
	const mobileStep: MobileStep = !isMobileLocationsOpen
		? 'globe'
		: focusedLocation
			? 'card'
			: 'list';

	// Tracks the previous step during render (same "adjust state while
	// rendering" pattern as prevIsDesktop below) purely to know which
	// direction the current transition moves in — forward (deeper into
	// globe→list→card) or backward — even when a step gets skipped, e.g.
	// tapping a marker jumps straight from globe to card. List/Card read
	// this off the `custom` prop on their AnimatePresence below, which
	// Framer forwards to the exiting pane too so the entering and exiting
	// pane always agree on direction.
	//
	// mobileStepDirection itself has to be state, not a local computed on the
	// fly from comparing mobileStep to prevMobileStep: setPrevMobileStep
	// below forces React to immediately redo this render with the new
	// prevMobileStep already in place, and on that redo mobileStep ===
	// prevMobileStep, so a freshly-recomputed value would always collapse
	// back to a hardcoded default instead of keeping whatever direction was
	// just determined.
	const [prevMobileStep, setPrevMobileStep] = useState<MobileStep>(mobileStep);
	const [mobileStepDirection, setMobileStepDirection] = useState<1 | -1>(1);
	if (mobileStep !== prevMobileStep) {
		setMobileStepDirection(
			MOBILE_STEP_ORDER[mobileStep] > MOBILE_STEP_ORDER[prevMobileStep] ? 1 : -1
		);
		setPrevMobileStep(mobileStep);
	}

	function selectLocation(location: [number, number]) {
		const nextFocus = isFocused(focusOn, location) ? null : location;
		setFocusOn(nextFocus);
		setIsDoubleTapZoomed(false);
		// Tapping a marker directly on the mobile globe view should land
		// straight on its card, skipping the list — see mobileStep above.
		if (!isDesktop && nextFocus) setIsMobileLocationsOpen(true);
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
			focused && isDesktop
				? locations.find((loc) => isFocused(marker.location, loc.location))
				: undefined;

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
					{detail ? (
						// LocationInfoCard itself is w-full — this fixed-width wrapper
						// is what gives it its 361px desktop size (mobile instead
						// matches the locations list's own responsive width; see the
						// mobile card block below).
						<div key={detail.label} className="w-[361px]">
							<LocationInfoCard location={detail} />
						</div>
					) : null}
				</AnimatePresence>
				<div
					className={cn(
						'relative flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[9000px] border px-2.5 py-2 text-xs leading-none font-medium whitespace-nowrap shadow-lg transition-[background-color,color,border-color,box-shadow,transform] duration-300 hover:scale-105 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.18)] active:scale-95',
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
						// group-active mirrors group-hover so tapping a row on mobile
						// (which has no :hover) gets the same gray press feedback
						// desktop gets on hover — a no-op on desktop, since hover
						// already covers that case there.
						<span className="absolute inset-0 -translate-x-full rounded-full bg-[#f4f6f7] transition-transform duration-200 ease-out group-hover:translate-x-0 group-active:translate-x-0" />
					)}
					<span
						className={`relative flex w-full items-center gap-[6px] px-[20px] py-[12px] text-left font-['Inter'] text-[14px] leading-[1.5] font-normal transition-colors duration-200 ease-out ${
							focused
								? 'text-white'
								: 'text-[#7c868e] group-hover:text-[#041c2c] group-active:text-[#041c2c]'
						}`}
					>
						{loc.label}
						{/* Same chevron glyph as the Back buttons', mirrored to point
						    right — a hint that a row opens further detail (the card),
						    not just a plain list selection. fill="currentColor" rides
						    the label's own color transitions above for free. */}
						<svg
							width="4"
							height="6"
							viewBox="0 0 4 6"
							fill="none"
							aria-hidden="true"
							className="shrink-0 scale-x-[-1]"
						>
							<path
								d="M1.08828 2.8252L3.13828 4.8752C3.22995 4.96686 3.27578 5.0752 3.27578 5.2002C3.27578 5.31686 3.22995 5.42103 3.13828 5.5127C3.04661 5.60436 2.93828 5.6502 2.81328 5.6502C2.69661 5.6502 2.59245 5.60436 2.50078 5.5127L0.125781 3.1377C0.0841149 3.09603 0.0507816 3.0502 0.0257815 3.0002C0.00911486 2.94186 0.000781536 2.88353 0.000781536 2.8252C0.000781536 2.76686 0.00911486 2.7127 0.0257815 2.66269C0.0507816 2.60436 0.0841149 2.55436 0.125781 2.5127L2.50078 0.137695C2.59245 0.0460281 2.69661 0.000194788 2.81328 0.000194788C2.93828 0.000194788 3.04661 0.0460281 3.13828 0.137695C3.22995 0.229362 3.27578 0.337695 3.27578 0.462695C3.27578 0.579362 3.22995 0.683528 3.13828 0.775195L1.08828 2.8252Z"
								fill="currentColor"
							/>
						</svg>
					</span>
				</button>
			);
		});
	}

	// Variants for the list/card panes below — a ±32px nudge + opacity
	// crossfade (no blur — dropped to see whether it was contributing to the
	// frame drops the same way it was on the globe pane, see the no-blur
	// comment on that pane below). `custom` (the direction Framer passes
	// through from AnimatePresence, see mobileStepDirection above) decides
	// which side: entering/exiting to the right for a forward step, to the
	// left for a backward one.
	const mobilePageVariants = {
		enter: (direction: 1 | -1) =>
			prefersReducedMotion ? { opacity: 0 } : { x: direction === 1 ? 32 : -32, opacity: 0 },
		center: prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 },
		exit: (direction: 1 | -1) =>
			prefersReducedMotion ? { opacity: 0 } : { x: direction === 1 ? -32 : 32, opacity: 0 }
	};

	return (
		<div className="flex min-h-screen w-full flex-col items-center gap-4 bg-white px-4 py-6 lg:justify-center lg:px-6">
			<main className="relative flex aspect-[361/674] h-auto w-full shrink-0 items-center justify-center overflow-hidden rounded-[48px] border-[0.5px] border-[#cbd1d6] bg-white lg:aspect-auto lg:h-[700px]">
				<motion.div
					className={cn(
						'absolute inset-0',
						mobileStep !== 'globe' && 'pointer-events-none lg:pointer-events-auto'
					)}
					// No blur here unlike the list/card panes' matching transition
					// below: this pane wraps the live WebGL canvas plus its
					// per-marker overlay, which the canvas already redraws (and
					// React re-renders) every animation frame regardless of this
					// transition — animating a CSS blur on top of that forces the
					// browser to re-rasterize that whole layer every frame too,
					// which is what was making this specific transition stutter.
					// Transform + opacity alone stay GPU-composited without it.
					animate={
						prefersReducedMotion
							? { opacity: mobileStep === 'globe' ? 1 : 0 }
							: { x: mobileStep === 'globe' ? 0 : -32, opacity: mobileStep === 'globe' ? 1 : 0 }
					}
					transition={MOBILE_PANE_TRANSITION}
					aria-hidden={mobileStep !== 'globe'}
				>
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
						// Stays true on desktop (mobileStep is always 'globe' there —
						// nothing ever opens the mobile locations pane) and pauses the
						// whole render loop on mobile whenever the globe pane isn't the
						// active step, so it isn't still burning CPU/GPU — and
						// competing with the transition bringing it back — the entire
						// time it's hidden behind the list/card pane.
						active={mobileStep === 'globe'}
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

					<div className="pointer-events-none absolute top-[36px] left-[36px] flex w-[calc(100%-72px)] flex-col items-start gap-4 lg:hidden">
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

					<button
						type="button"
						onClick={openMobileLocations}
						className="pointer-events-auto absolute right-[36px] bottom-[36px] inline-flex shrink-0 items-center gap-2 rounded-[9000px] border border-[#82e472] bg-[#44d62c] px-4 py-3 text-sm font-normal text-[#041c2c] transition-colors duration-200 ease-out hover:bg-[#3bc224] lg:hidden"
					>
						Explore locations
						<span aria-hidden="true" className="text-sm leading-none">
							→
						</span>
					</button>
				</motion.div>

				{/* Mobile-only: the list and card panes, filling the same card the
				    globe pane above does. Only one is ever mounted (as opposed to
				    the always-mounted globe pane) — cheap to recreate, unlike the
				    WebGL canvas — so they participate directly in the same
				    AnimatePresence and share its `custom` direction, keeping all
				    three steps on one consistent forward/backward convention. */}
				<AnimatePresence initial={false} custom={mobileStepDirection}>
					{mobileStep === 'list' ? (
						<motion.div
							key="list"
							custom={mobileStepDirection}
							variants={mobilePageVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={MOBILE_PANE_TRANSITION}
							className="absolute inset-0 flex w-full flex-col gap-[16px] p-[36px] lg:hidden"
						>
							{/* min-h-0 overrides the flex item's default min-height:
							    auto, which would otherwise let it grow past the pane's
							    bottom edge (rather than scroll) since its content can
							    exceed the available space — and <main>'s overflow-hidden
							    would then hard-clip it instead of this scrolling. */}
							<div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto">
								{renderLocationRows()}
							</div>
							{/* Negative x/bottom margins cancel the pane's own 36px
							    padding on those sides, so the gradient below (inset-0
							    within this footer) bleeds all the way to the card's true
							    edges instead of stopping short at the padded content
							    area — the matching px/pb restores the button's own
							    position exactly where it was. Top gets no such
							    treatment: the footer's top edge is exactly where the
							    scrollable list above it ends, which is where the
							    gradient should start fading in from, per the brief.
							    z-0 (not just relative) makes this its own stacking
							    context, so the gradient's -z-10 below is always resolved
							    locally against it — without an explicit z-index here, the
							    gradient's context depends on whether the *animated*
							    list-pane ancestor currently has a live transform/opacity
							    inline style (only true while Framer's transition is
							    actually running), so the gradient would render correctly
							    mid-transition but escape behind the whole card once it
							    settles and that inline styling drops away. */}
							<div className="relative z-0 -mx-[36px] -mb-[36px] shrink-0 px-[36px] pb-[36px]">
								{/* z-index below the button (a plain, non-positioned
								    element) so it paints as a backdrop behind it rather
								    than over it — an absolutely positioned layer with no
								    z-index would otherwise paint above in-flow content by
								    default. */}
								<div
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black to-transparent"
								/>
								<button
									type="button"
									onClick={closeMobileLocations}
									className="inline-flex w-fit shrink-0 items-center gap-[6px] self-start rounded-[9000px] border border-[#e6eaed] bg-[#f4f6f7] px-[14px] py-[10px] text-[12px] font-normal text-[#041c2c] transition-colors duration-200 ease-out hover:bg-[#e6eaed]"
								>
									<svg
										width="4"
										height="6"
										viewBox="0 0 4 6"
										fill="none"
										aria-hidden="true"
										className="shrink-0"
									>
										<path
											d="M1.08828 2.8252L3.13828 4.8752C3.22995 4.96686 3.27578 5.0752 3.27578 5.2002C3.27578 5.31686 3.22995 5.42103 3.13828 5.5127C3.04661 5.60436 2.93828 5.6502 2.81328 5.6502C2.69661 5.6502 2.59245 5.60436 2.50078 5.5127L0.125781 3.1377C0.0841149 3.09603 0.0507816 3.0502 0.0257815 3.0002C0.00911486 2.94186 0.000781536 2.88353 0.000781536 2.8252C0.000781536 2.76686 0.00911486 2.7127 0.0257815 2.66269C0.0507816 2.60436 0.0841149 2.55436 0.125781 2.5127L2.50078 0.137695C2.59245 0.0460281 2.69661 0.000194788 2.81328 0.000194788C2.93828 0.000194788 3.04661 0.0460281 3.13828 0.137695C3.22995 0.229362 3.27578 0.337695 3.27578 0.462695C3.27578 0.579362 3.22995 0.683528 3.13828 0.775195L1.08828 2.8252Z"
											fill="#041C2C"
										/>
									</svg>
									Back to map
								</button>
							</div>
						</motion.div>
					) : mobileStep === 'card' && focusedLocation ? (
						<motion.div
							key="card"
							custom={mobileStepDirection}
							variants={mobilePageVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={MOBILE_PANE_TRANSITION}
							className="absolute inset-0 lg:hidden"
						>
							{/* LocationInfoCard supplies its own 36px padding in its
							    mobile (bare, no chrome) variant — see isMobile there —
							    so this pane doesn't add a second layer of padding on
							    top of it the way the list pane's does. */}
							<LocationInfoCard location={focusedLocation} onBack={deselectLocation} />
						</motion.div>
					) : null}
				</AnimatePresence>
			</main>
		</div>
	);
}

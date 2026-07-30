import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import { Globe, type GlobeMarker, type GlobeMarkerTooltipContext } from './components/globe';
import { cn } from './lib/cn';

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

const locations: { label: string; location: [number, number] }[] = [
	{ label: 'San Francisco', location: [37.7749, -122.4194] },
	{ label: 'New York', location: [40.7128, -74.006] },
	{ label: 'London', location: [51.5074, -0.1278] },
	{ label: 'Berlin', location: [52.52, 13.405] },
	{ label: 'Tokyo', location: [35.6762, 139.6503] },
	{ label: 'Singapore', location: [1.3521, 103.8198] },
	{ label: 'Sydney', location: [-33.8688, 151.2093] },
	{ label: 'Paris', location: [48.8566, 2.3522] },
	{ label: 'Madrid', location: [40.4168, -3.7038] },
	{ label: 'Rome', location: [41.9028, 12.4964] },
	{ label: 'Amsterdam', location: [52.3676, 4.9041] },
	{ label: 'Vienna', location: [48.2082, 16.3738] }
];

function isFocused(focusOn: [number, number] | null, location: [number, number]) {
	return focusOn !== null && focusOn[0] === location[0] && focusOn[1] === location[1];
}

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
	const [scale, setScale] = useState(defaultScale);
	const [focusOn, setFocusOn] = useState<[number, number] | null>(null);

	// isDesktop is only known for certain after mount (SSR/first paint assumes
	// desktop), and can change later from an actual viewport resize. Re-sync
	// `scale` to the new breakpoint's default during render (React's supported
	// pattern for "adjust state when a prop changes") rather than in an
	// effect, but only when not focused, so a resize can't yank the view out
	// from under an active selection.
	const [prevIsDesktop, setPrevIsDesktop] = useState(isDesktop);
	if (isDesktop !== prevIsDesktop) {
		setPrevIsDesktop(isDesktop);
		if (!focusOn) setScale(defaultScale);
	}

	const pointCount = basePointCount;
	const pointSize = basePointSize;
	const markerSize = baseMarkerSize * (defaultScale / scale);

	const scaleAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

	function animateScaleTo(target: number) {
		scaleAnimationRef.current?.stop();
		scaleAnimationRef.current = animate(scale, target, {
			duration: 0.5,
			ease: 'easeInOut',
			onUpdate: (latest) => setScale(latest)
		});
	}

	const markers: GlobeMarker[] = locations.map(({ label, location }) => ({
		location,
		label,
		color: '#041c2c',
		size: markerSize
	}));

	function selectLocation(location: [number, number]) {
		const nextFocus = isFocused(focusOn, location) ? null : location;
		setFocusOn(nextFocus);
		animateScaleTo(nextFocus ? focusScale : defaultScale);
	}

	function deselectLocation() {
		if (!focusOn) return;
		setFocusOn(null);
		animateScaleTo(defaultScale);
	}

	function renderMarkerTooltip({ marker }: GlobeMarkerTooltipContext) {
		const focused = isFocused(focusOn, marker.location);
		return (
			<div
				className={cn(
					'relative flex items-center gap-2.5 rounded-[9000px] border px-2.5 py-2 text-xs leading-none font-medium whitespace-nowrap shadow-lg transition-[background-color,color,border-color] duration-300',
					focused
						? 'border-[#42515d] bg-[#041c2c] text-white'
						: 'border-[#e6eaed] bg-white text-[#041c2c] hover:bg-[#f4f6f7]'
				)}
			>
				<span className="size-2 shrink-0 rounded-full bg-[#44d62c]" />
				{marker.label}
			</div>
		);
	}

	function renderLocationRows() {
		return locations.map((loc) => {
			const focused = isFocused(focusOn, loc.location);
			return (
				<button
					key={loc.label}
					type="button"
					onClick={() => selectLocation(loc.location)}
					className="group relative min-h-[26px] w-full shrink-0 overflow-hidden rounded-full"
				>
					{focused ? (
						<span className="absolute inset-0 rounded-full bg-[#44d62c]" />
					) : (
						<span className="absolute inset-0 -translate-x-full rounded-full bg-[#f4f6f7] transition-transform duration-200 ease-out group-hover:translate-x-0" />
					)}
					<span
						className={`relative block p-[12px] text-left font-['Inter'] text-[14px] leading-none font-normal tracking-[-0.28px] ${
							focused ? 'text-white' : 'text-[#7c868e]'
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
			<main className="relative flex h-auto w-full shrink-0 items-center justify-center overflow-hidden rounded-[16px] border-[0.5px] border-[#cbd1d6] bg-white aspect-[361/674] lg:aspect-auto lg:h-[700px] lg:rounded-[24px]">
				<Globe
					className={cn(
						'absolute top-0 left-[-15%] h-full w-[130%]',
						'lg:inset-0 lg:top-auto lg:left-auto lg:h-full lg:w-full'
					)}
					scale={scale}
					offsetX={isDesktop ? 1 / 6 : 0}
					offsetY={isDesktop ? 0 : MOBILE_OFFSET_Y}
					rotation={5}
					axialTilt={-23}
					pointCount={pointCount}
					pointSize={pointSize}
					landPointColor="#44d62c"
					fresnelConfig={{ color: '#e4e4e4', rimColor: '#44d62c' }}
					markers={markers}
					markerTooltip={renderMarkerTooltip}
					onMarkerClick={(marker) => selectLocation(marker.location)}
					onBackgroundClick={deselectLocation}
					focusOn={focusOn}
					autoRotate={!focusOn}
					lockedPolarAngle={!focusOn}
				/>

				<div className="absolute top-[47.5px] left-[47.5px] hidden items-center gap-[48px] lg:flex">
					<span className="size-[10px] shrink-0 rounded-full bg-[#44d62c]" />
					<span className="font-['Geist_Mono'] text-[12px] leading-[1.05] font-normal text-[#7c868e] uppercase">
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

				<div className="absolute right-[12.5px] bottom-[12.5px] hidden h-[502px] w-[244px] flex-col overflow-hidden rounded-[12px] border-[0.5px] border-[#e6eaed] bg-white lg:flex">
					<span className="shrink-0 pt-[15.5px] pb-[16px] pl-[23.5px] font-['Geist_Mono'] text-[12px] leading-none font-normal tracking-[-0.24px] text-[#7c868e] uppercase">
						locations
					</span>
					<div className="mx-[11.5px] shrink-0 border-t-[0.5px] border-[#cbd1d6]" />
					<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[11.5px] pt-[8px] pb-[11.5px]">
						{renderLocationRows()}
					</div>
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

			<div className="flex max-h-[260px] w-full flex-col overflow-hidden rounded-[12px] border-[0.5px] border-[#e6eaed] bg-white lg:hidden">
				<span className="shrink-0 pt-[15.5px] pb-[16px] pl-[23.5px] font-['Geist_Mono'] text-[12px] leading-none font-normal tracking-[-0.24px] text-[#7c868e] uppercase">
					locations
				</span>
				<div className="mx-[11.5px] shrink-0 border-t-[0.5px] border-[#cbd1d6]" />
				<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[11.5px] pt-[8px] pb-[11.5px]">
					{renderLocationRows()}
				</div>
			</div>
		</div>
	);
}

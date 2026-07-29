import { useRef, useState } from 'react';
import { animate } from 'motion';
import { Globe, type GlobeMarker, type GlobeMarkerTooltipContext } from './components/globe';
import { cn } from './lib/cn';

const defaultScale = 1.5;
const focusScale = 1.8;

// A point at fixed sphere-space size projects to screen-space size
// proportional to `scale` (that's what "zoom" means here), and the
// lattice's nearest-neighbor spacing shrinks as 1/scale for the same
// reason once pointCount is scaled to compensate. So to hold both the
// on-screen dot size AND the dot-to-gap ratio constant across zoom
// levels: pointCount grows with scale² (density is an area effect),
// while pointSize/markerSize shrink linearly with 1/scale.
// The lattice shader's index decoder was extended to a 23-bit unroll
// (GlobeScene.tsx), so pointCount is no longer limited to 32767 —
// but its `k` bucket estimate (also in GlobeScene.tsx) is only an
// approximation, and pushing pointCount past ~150-200k makes that
// approximation visibly break down as moiré rings/voids (worst near
// the poles). Capped below that threshold: density still grows
// noticeably with zoom, it just plateaus before the artifact appears.
const basePointCount = 29000;
const basePointSize = 0.087;
const maxPointCount = 150_000;
const baseMarkerSize = 0.06;

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

export default function App() {
	const [scale, setScale] = useState(defaultScale);
	const [axialTilt, setAxialTilt] = useState(-23);
	const [focusOn, setFocusOn] = useState<[number, number] | null>(null);

	const pointCount = Math.min(
		maxPointCount,
		Math.round(basePointCount * (scale / defaultScale) ** 2)
	);
	const pointSize = basePointSize * (defaultScale / scale);
	const markerSize = baseMarkerSize * (defaultScale / scale);

	const scaleAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

	function animateScaleTo(target: number) {
		scaleAnimationRef.current?.stop();
		scaleAnimationRef.current = animate(scale, target, {
			duration: 1.5,
			ease: 'easeInOut',
			onUpdate: (latest) => setScale(latest)
		});
	}

	const markers: GlobeMarker[] = locations.map(({ label, location }) => ({
		location,
		label,
		color: '#111113',
		size: markerSize
	}));

	function selectLocation(location: [number, number]) {
		const nextFocus = isFocused(focusOn, location) ? null : location;
		setFocusOn(nextFocus);
		animateScaleTo(nextFocus ? focusScale : defaultScale);
	}

	function renderMarkerTooltip({ marker }: GlobeMarkerTooltipContext) {
		const focused = isFocused(focusOn, marker.location);
		return (
			<div
				className={cn(
					'relative flex items-center gap-1.5 rounded-[9000px] border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg transition-[background-color,color,border-color] duration-300',
					focused
						? 'border-transparent bg-[#041c2c] text-white'
						: 'border-black/10 bg-white text-black'
				)}
			>
				<span className="h-1.5 w-1.5 rounded-full bg-[#44d62c]" />
				{marker.label}
			</div>
		);
	}

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-white p-6">
			<main className="relative flex h-[700px] w-full items-center justify-center overflow-hidden rounded-[24px] border-[0.5px] border-[#cbd1d6] bg-white">
				<Globe
					className="h-full w-full"
					scale={scale}
					offsetX={1 / 6}
					rotation={5}
					axialTilt={axialTilt}
					pointCount={pointCount}
					pointSize={pointSize}
					landPointColor="#44d62c"
					fresnelConfig={{ color: '#e4e4e4', rimColor: '#44d62c' }}
					markers={markers}
					markerTooltip={renderMarkerTooltip}
					onMarkerClick={(marker) => selectLocation(marker.location)}
					focusOn={focusOn}
					autoRotate={!focusOn}
					lockedPolarAngle={!focusOn}
				/>

				<div className="absolute top-[47.5px] left-[47.5px] flex items-center gap-[48px]">
					<span className="size-[10px] shrink-0 rounded-full bg-[#44d62c]" />
					<span className="font-['Geist_Mono'] text-[12px] leading-[1.05] font-normal text-[#7c868e] uppercase">
						locations
					</span>
				</div>

				<div className="absolute bottom-[47.5px] left-[47.5px] flex w-[433px] flex-col gap-[16px]">
					<p className="font-['Inter'] text-[48px] leading-[1.05] font-medium tracking-[-1.44px] text-[#041c2c]">
						Built across Europe, <span className="text-[#7c868e]">with local partners.</span>
					</p>
					<p className="font-['Inter'] text-[16px] leading-[1.5] font-normal text-[#7c868e]">
						See where NGEN operates and find relevant projects, offices and partners near you.
					</p>
				</div>

				<div className="absolute right-[12.5px] bottom-[12.5px] flex h-[502px] w-[244px] flex-col overflow-hidden rounded-[12px] border-[0.5px] border-[#e6eaed] bg-white">
					<span className="shrink-0 pt-[15.5px] pb-[16px] pl-[23.5px] font-['Geist_Mono'] text-[12px] leading-none font-normal tracking-[-0.24px] text-[#7c868e] uppercase">
						locations
					</span>
					<div className="mx-[11.5px] shrink-0 border-t-[0.5px] border-[#cbd1d6]" />
					<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[11.5px] pt-[8px] pb-[11.5px]">
						{locations.map((loc) => {
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
						})}
					</div>
				</div>
			</main>

			<div className="flex w-72 flex-col gap-2 rounded-xl border border-black/10 bg-black/5 px-4 py-3 backdrop-blur-md">
				<div className="flex items-center justify-between text-xs text-black/70">
					<span>Axis tilt</span>
					<span className="text-black tabular-nums">{axialTilt.toFixed(0)}°</span>
				</div>
				<input
					type="range"
					min="-90"
					max="90"
					step="1"
					value={axialTilt}
					onChange={(event) => setAxialTilt(Number(event.target.value))}
					className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/15 accent-[#44d62c]"
				/>
			</div>
		</div>
	);
}

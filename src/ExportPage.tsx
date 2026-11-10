import { useRef, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import {
	Globe,
	type GlobeHandle,
	type GlobeMarker,
	type GlobeMarkerTooltipContext
} from './components/globe';
import { PinsPanel } from './components/PinsPanel';
import { cn } from './lib/cn';
import { BUTTON_STYLE, FIELD_STYLE, LABEL_STYLE } from './lib/controlStyles';
import { usePinsEditor } from './lib/pinsEditor';

// This page's own country list — a different, smaller set than the
// city-level `locations` in lib/locations.ts (which drives the root
// route's pins/list/cards). Pinned by capital city since these entries are
// country-level, not city-level.
const EXPORT_COUNTRIES: { label: string; location: [number, number] }[] = [
	{ label: 'Slovenija', location: [46.0569, 14.5058] },
	{ label: 'Austria', location: [48.2082, 16.3738] },
	{ label: 'Germany', location: [52.52, 13.405] },
	{ label: 'Spain', location: [40.4168, -3.7038] },
	{ label: 'Poland', location: [52.2297, 21.0122] },
	{ label: 'Croatia', location: [45.815, 15.9819] },
	{ label: 'Portugal', location: [38.7223, -9.1393] },
	{ label: 'United Kingdom', location: [51.5074, -0.1278] },
	{ label: 'Australia', location: [-33.8688, 151.2093] },
	{ label: 'Netherlands', location: [52.3676, 4.9041] },
	{ label: 'Latvia', location: [56.9496, 24.1052] },
	{ label: 'Romania', location: [44.4268, 26.1025] }
];

// Bare export view: just the globe with its location tags, filling the
// whole browser window on a pure white page — no tooltips/cards, no
// click/focus interactions, intended for embedding/screen-recording rather
// than the full App UI. The one control it does offer is the size/zoom
// slider below, for framing the globe before a capture.
//
// GlobeScene renders the sphere as a circle of radius 0.8 (in its own
// normalized display space) and only guarantees it stays fully inside the
// frame while `scale <= min(1, width/height) / 0.8`. The root route's
// DESKTOP_DEFAULT_SCALE (1.5) exceeds that on purpose — it's a decorative,
// intentionally-cropped background behind an overflow-hidden card — but
// here the globe is meant to be fully visible, so the slider's max (1.25)
// stays under that bound for a roughly square-or-wider viewport.
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.25;
const POINT_COUNT = 35000;
const POINT_SIZE = 0.07;
const BASE_MARKER_SIZE = 0.06;

// Multiplier on GlobeScene's base auto-rotate speed — 1 is that default
// speed, 0 holds the globe still.
const DEFAULT_ROTATION_SPEED = 1;
const MIN_ROTATION_SPEED = 0;
const MAX_ROTATION_SPEED = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function ExportPage() {
	const globeRef = useRef<GlobeHandle>(null);
	const [scale, setScale] = useState(DEFAULT_SCALE);
	const [rotationSpeed, setRotationSpeed] = useState(DEFAULT_ROTATION_SPEED);
	const pinsEditor = usePinsEditor(EXPORT_COUNTRIES);
	// Progress toward the export's two-lap sequence — see GlobeScene's
	// exportRotationVideo: an unrecorded warm-up lap (settling the GL
	// viewport resize/shader warm-up before recording starts) followed by
	// the actual recorded lap, independent of the Rotation Speed slider
	// above.
	const [exportStatus, setExportStatus] = useState<{
		phase: 'warmup' | 'recording';
		fraction: number;
	} | null>(null);
	const isExporting = exportStatus !== null;

	async function handleExportVideo() {
		if (isExporting) return;
		setExportStatus({ phase: 'warmup', fraction: 0 });
		try {
			await globeRef.current?.exportRotationVideo({ onProgress: setExportStatus });
		} catch (error) {
			console.error('Globe rotation export failed', error);
			window.alert(error instanceof Error ? error.message : 'Export failed.');
		} finally {
			setExportStatus(null);
		}
	}

	function resetScale() {
		setScale(DEFAULT_SCALE);
	}

	function resetRotationSpeed() {
		setRotationSpeed(DEFAULT_ROTATION_SPEED);
	}

	// Marker pins are sized in world units, which scale with the globe
	// itself — without compensating here, zooming in/out would make the pins
	// balloon or shrink along with the sphere instead of holding a roughly
	// constant on-screen size (same technique as App.tsx's markerSize).
	const markerSize = BASE_MARKER_SIZE * (DEFAULT_SCALE / scale);

	const markers: GlobeMarker[] = pinsEditor.pins.map(({ label, location }) => ({
		location,
		label,
		color: '#041c2c',
		size: markerSize
	}));

	return (
		<div className="relative h-screen w-screen bg-white">
			<Globe
				ref={globeRef}
				className="h-full w-full"
				scale={scale}
				rotation={5}
				axialTilt={-23}
				pointCount={POINT_COUNT}
				pointSize={POINT_SIZE}
				landPointColor="#44d62c"
				fresnelConfig={{ color: '#E6EAED', rimColor: '#44D62C' }}
				markers={markers}
				markerTooltip={renderMarkerTag}
				autoRotate={rotationSpeed !== 0}
				autoRotateSpeed={rotationSpeed}
				lockedPolarAngle
			/>

			<PinsPanel
				editor={pinsEditor}
				className="pointer-events-auto absolute top-[36px] left-[36px]"
			/>

			<div className="pointer-events-auto absolute right-[36px] bottom-[36px] flex w-[400px] flex-col gap-4 rounded-[24px] border-[0.5px] border-[#e6eaed] bg-white/90 p-5 shadow-lg backdrop-blur-sm">
				<SliderRow
					label="Globe Size"
					min={MIN_SCALE}
					max={MAX_SCALE}
					step={0.01}
					value={scale}
					onChange={setScale}
					onReset={resetScale}
				/>
				<SliderRow
					label="Rotation Speed"
					min={MIN_ROTATION_SPEED}
					max={MAX_ROTATION_SPEED}
					step={0.1}
					value={rotationSpeed}
					onChange={setRotationSpeed}
					onReset={resetRotationSpeed}
				/>

				<button
					type="button"
					onClick={handleExportVideo}
					disabled={isExporting}
					className="mt-1 flex min-h-7.5 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[32px] border border-[#82e472] bg-[#44d62c] font-['Inter'] text-xs font-medium text-[#041c2c] transition-all duration-80 outline-none hover:bg-[#3bc224] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:scale-98 disabled:pointer-events-none disabled:opacity-70"
				>
					{exportStatus ? (
						<>
							<Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
							{exportStatus.phase === 'warmup'
								? `Warming up ${Math.round(exportStatus.fraction * 100)}%`
								: `Exporting ${Math.round(exportStatus.fraction * 100)}%`}
						</>
					) : (
						<>
							<Download size={14} strokeWidth={2} aria-hidden="true" />
							Export
						</>
					)}
				</button>
			</div>
		</div>
	);
}

// The Size and Rotation rows are structurally identical (label, slider,
// value field, reset), so sharing one component is what keeps their inner
// spacing — the gap-3 between items and the field's own padding — actually
// equal, rather than two hand-copied rows drifting apart over edits.
function SliderRow({
	label,
	min,
	max,
	step,
	value,
	onChange,
	onReset
}: {
	label: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => void;
	onReset: () => void;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className={cn(LABEL_STYLE, 'w-[104px] shrink-0')}>{label}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[#e6eaed] accent-[#041c2c]"
				aria-label={label}
			/>
			<input
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => {
					const next = Number(event.target.value);
					if (!Number.isNaN(next)) onChange(clamp(next, min, max));
				}}
				className={cn(
					FIELD_STYLE,
					'w-[52px] shrink-0 [appearance:textfield] px-1.5 py-1 text-right text-[11px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
				)}
				aria-label={`${label} value`}
			/>
			<ResetButton onClick={onReset} label={`Reset ${label.toLowerCase()} to default`} />
		</div>
	);
}

function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(BUTTON_STYLE, 'size-7.5 shrink-0 p-0')}
			aria-label={label}
			title={label}
		>
			<RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
		</button>
	);
}

// Same pill styling as the root route's unfocused marker tag (see
// App.tsx's renderMarkerTooltip) — no focused/selected state here since this
// page has no click/focus interaction, so only that one variant applies.
function renderMarkerTag({ marker }: GlobeMarkerTooltipContext) {
	return (
		<div className="relative flex shrink-0 items-center gap-2.5 rounded-[9000px] border border-[#e6eaed] bg-white px-2.5 py-2 text-xs leading-none font-medium whitespace-nowrap text-[#041c2c] shadow-lg">
			<span className="size-2 shrink-0 rounded-full bg-[#44d62c]" />
			{marker.label}
		</div>
	);
}

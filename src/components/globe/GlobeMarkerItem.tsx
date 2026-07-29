import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import type { GlobeMarker, GlobeMarkerTooltipRenderer } from './types';

interface Props {
	/**
	 * The marker data object containing location, color, size, etc.
	 */
	marker: GlobeMarker;
	/**
	 * Marker index in the markers array.
	 */
	index: number;
	/**
	 * Horizontal marker position in normalized [0, 1] viewport space.
	 */
	screenX: number;
	/**
	 * Vertical marker position in normalized [0, 1] viewport space.
	 */
	screenY: number;
	/**
	 * Marker visibility factor in range [0, 1].
	 */
	visibility: number;
	/**
	 * Optional custom tooltip renderer.
	 */
	tooltip?: GlobeMarkerTooltipRenderer;
	/**
	 * Whether this marker is the currently-selected/focused one. Selected
	 * markers are raised above all others regardless of DOM order.
	 */
	isSelected?: boolean;
	/**
	 * Called when the tooltip/label is clicked (or activated via keyboard).
	 * When provided, the tooltip becomes an interactive hit target.
	 */
	onSelect?: () => void;
}

const MAX_TOOLTIP_BLUR = 8;

export default function GlobeMarkerItem({
	marker,
	index,
	screenX,
	screenY,
	visibility,
	tooltip,
	isSelected = false,
	onSelect
}: Props) {
	const tooltipBlur = (1 - visibility) * MAX_TOOLTIP_BLUR;

	// z-index is set here, on the element whose own `transform` establishes its
	// stacking context — a z-index set deeper (e.g. inside a custom tooltip
	// renderer) would be trapped inside descendant stacking contexts created by
	// this component's own `transform`/`filter` styles and could never actually
	// out-rank a sibling marker.
	const containerStyle: CSSProperties = {
		left: `${screenX * 100}%`,
		top: `${screenY * 100}%`,
		transform: 'translate(-50%, -50%)',
		zIndex: isSelected ? 1 : undefined
	};

	const tooltipStyle: CSSProperties = {
		opacity: visibility,
		filter: `blur(${tooltipBlur}px)`
	};

	const tooltipRef = useRef<HTMLDivElement>(null);
	const hoveredRef = useRef(false);

	// Direction-aware easing: the browser uses whatever transition-timing-function
	// is current at the moment --scale-active changes, so setting it inline right
	// before each write gives a clean ease-in going into a hovered/pressed state
	// and a bouncy spring-back easing on the way out — without a second
	// "is-leaving" class or transition declaration. Scale only, no translate, so
	// it grows/shrinks in place from `transform-origin: center` (.t-avatar).
	const applyTransformState = (
		phase: 'in' | 'out',
		{ hovered, pressed }: { hovered: boolean; pressed: boolean }
	) => {
		const el = tooltipRef.current;
		if (!el || !onSelect) return;

		const rootStyle = getComputedStyle(document.documentElement);
		const num = (name: string, fallback: number) => {
			const value = Number.parseFloat(rootStyle.getPropertyValue(name));
			return Number.isFinite(value) ? value : fallback;
		};
		const ease = (name: string, fallback: string) =>
			rootStyle.getPropertyValue(name).trim() || fallback;

		const hoverScale = num('--avatar-scale', 1.05);
		const pressScale = num('--avatar-press-scale', 0.94);
		const timingFunction =
			phase === 'out'
				? ease('--avatar-ease-out', 'cubic-bezier(0.34, 3.85, 0.64, 1)')
				: ease('--avatar-ease-in', 'cubic-bezier(0.22, 1, 0.36, 1)');

		el.style.transitionTimingFunction = timingFunction;
		el.style.setProperty('--scale-active', String(pressed ? pressScale : hovered ? hoverScale : 1));
	};

	const handleMouseEnter = () => {
		hoveredRef.current = true;
		applyTransformState('in', { hovered: true, pressed: false });
	};

	const handleMouseLeave = () => {
		hoveredRef.current = false;
		applyTransformState('out', { hovered: false, pressed: false });
	};

	const handlePointerDown = () => {
		applyTransformState('in', { hovered: true, pressed: true });
	};

	const handlePointerUp = () => {
		applyTransformState('out', { hovered: hoveredRef.current, pressed: false });
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!event.repeat) applyTransformState('in', { hovered: true, pressed: true });
			onSelect();
		}
	};

	const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			applyTransformState('out', { hovered: hoveredRef.current, pressed: false });
		}
	};

	return (
		<div className="pointer-events-none absolute" style={containerStyle}>
			{tooltip || marker.label ? (
				<div
					ref={tooltipRef}
					className={cn(
						'absolute top-0 left-1/2 inline-flex -translate-x-1/2 -translate-y-8 flex-col items-center rounded-[9000px] transition-[opacity,filter,box-shadow] duration-200 ease-out select-none',
						onSelect
							? 't-avatar pointer-events-auto cursor-pointer hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.18)]'
							: 'pointer-events-none'
					)}
					style={tooltipStyle}
					onClick={onSelect}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					onPointerDown={handlePointerDown}
					onPointerUp={handlePointerUp}
					onKeyDown={handleKeyDown}
					onKeyUp={handleKeyUp}
					role={onSelect ? 'button' : undefined}
					tabIndex={onSelect ? 0 : undefined}
				>
					{tooltip ? (
						tooltip({ marker, index, visibility })
					) : (
						<div className="rounded-xs bg-fixed-dark/80 px-2 py-1 text-xs whitespace-nowrap text-fixed-light backdrop-blur-sm">
							{marker.label}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}

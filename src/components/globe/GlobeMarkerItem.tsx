import type { CSSProperties, KeyboardEvent } from 'react';
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
	// out-rank a sibling marker. This only ever ranks the selected marker above
	// *other markers* — Globe's canvas+marker wrapper has its own z-0 stacking
	// context (see Globe.tsx), so nothing here can escape above a sibling UI
	// card regardless of this value; the selected marker stays under the
	// cards, same as every other marker, by design.
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

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!event.repeat) onSelect();
		}
	};

	// A custom tooltip renderer returning null/false is an explicit "no
	// tooltip for this marker" — falling through to the fallback label in
	// that case would show a tooltip the caller asked to suppress.
	const tooltipContent = tooltip ? tooltip({ marker, index, visibility }) : marker.label;

	return (
		<div className="pointer-events-none absolute" style={containerStyle}>
			{tooltipContent ? (
				<div
					className={cn(
						// translate-y is self-relative (100% of this element's own
						// height, not the zero-height positioning container), so
						// this element's *bottom* edge always lands a fixed 8px
						// above the marker point, regardless of content height.
						// For the focused marker, the tooltip renderer stacks the
						// info card above the pin *within* this same element (see
						// App.tsx), rather than this component knowing anything
						// about that content — the pin (last/bottom in that stack)
						// still ends up exactly at the marker point either way.
						'absolute top-0 left-1/2 inline-flex -translate-x-1/2 -translate-y-[calc(100%+8px)] flex-col items-center transition-[opacity,filter] duration-200 ease-out select-none',
						// No hover/press scale or shadow on this wrapper — it's
						// purely a click/keyboard target. Those visuals live on
						// the tooltip content's own elements instead (see the pin
						// in App.tsx), because this wrapper's size isn't just the
						// pin: for the just-deselected marker it still contains
						// the info card for ~300ms while it blurs out (see
						// AnimatePresence in App.tsx). isSelected flips the
						// instant you click, before that exit finishes, so a
						// wrapper-level hover effect would flash a shadow around
						// the whole fading card — not just the pin — if the
						// pointer is still sitting there from the click.
						onSelect ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
					)}
					style={tooltipStyle}
					onClick={onSelect}
					onKeyDown={handleKeyDown}
					role={onSelect ? 'button' : undefined}
					tabIndex={onSelect ? 0 : undefined}
				>
					{tooltip ? (
						tooltipContent
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

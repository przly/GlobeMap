import type { ComponentPropsWithoutRef } from 'react';
import GlobeScene from './GlobeScene';
import { cn } from '../../lib/cn';
import type { GlobeMarker, GlobeMarkerTooltipRenderer } from './types';

type SceneProps = ComponentPropsWithoutRef<typeof GlobeScene>;

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'className'> {
	/**
	 * Additional CSS classes for the container.
	 */
	className?: string;
	/**
	 * Scale multiplier for the globe field.
	 * @default 1
	 */
	scale?: SceneProps['scale'];
	/**
	 * Horizontal globe offset in normalized viewport units.
	 * @default 0
	 */
	offsetX?: SceneProps['offsetX'];
	/**
	 * Vertical globe offset in normalized viewport units.
	 * @default 0
	 */
	offsetY?: SceneProps['offsetY'];
	/**
	 * Globe field rotation in degrees.
	 * @default 0
	 */
	rotation?: SceneProps['rotation'];
	/**
	 * Tilt of the sphere's own polar axis, in degrees, relative to the
	 * fixed spin axis. Purely cosmetic — like Earth's 23.4° axial tilt,
	 * it makes autorotate trace a wobble instead of a perfectly upright spin.
	 * @default 0
	 */
	axialTilt?: SceneProps['axialTilt'];
	/**
	 * Optional overrides for the Fresnel shader uniforms.
	 */
	fresnelConfig?: SceneProps['fresnelConfig'];
	/**
	 * Number of points rendered on the surface.
	 * @default 15000
	 */
	pointCount?: SceneProps['pointCount'];
	/**
	 * Color applied to points that fall on land.
	 * @default "#f77114"
	 */
	landPointColor?: SceneProps['landPointColor'];
	/**
	 * Size of each point in world units.
	 * @default 0.05
	 */
	pointSize?: SceneProps['pointSize'];
	/**
	 * Whether the globe should auto-rotate.
	 * @default true
	 */
	autoRotate?: SceneProps['autoRotate'];
	/**
	 * Whether to lock the camera's polar angle (vertical rotation).
	 * If true, limits the vertical view to a narrow band.
	 * @default true
	 */
	lockedPolarAngle?: boolean;
	/**
	 * Array of markers to display on the globe.
	 */
	markers?: GlobeMarker[];
	/**
	 * Optional custom tooltip renderer for markers.
	 * Receives marker data and visibility context.
	 */
	markerTooltip?: GlobeMarkerTooltipRenderer;
	/**
	 * Called when a marker's tooltip/label is clicked. When provided, tooltips
	 * become clickable hit targets (same interaction as clicking a location
	 * in an external location list).
	 */
	onMarkerClick?: SceneProps['onMarkerClick'];
	/**
	 * Called when the canvas background is tapped/clicked directly (not a
	 * drag-to-rotate gesture, and not a marker tooltip).
	 */
	onBackgroundClick?: SceneProps['onBackgroundClick'];
	/**
	 * Coordinates [lat, lon] to focus the camera on.
	 * When set, auto-rotation will be disabled temporarily.
	 */
	focusOn?: [number, number] | null;
}

export default function Globe({
	className = '',
	scale = 1,
	offsetX = 0,
	offsetY = 0,
	rotation = 0,
	axialTilt = 0,
	fresnelConfig,
	pointCount,
	landPointColor,
	pointSize,
	autoRotate = true,
	lockedPolarAngle = true,
	markers = [],
	markerTooltip,
	onMarkerClick,
	onBackgroundClick,
	focusOn = null,
	...rest
}: Props) {
	return (
		<div className={cn('relative h-full w-full overflow-hidden', className)} {...rest}>
			<div className="absolute inset-0 z-0">
				<GlobeScene
					scale={scale}
					offsetX={offsetX}
					offsetY={offsetY}
					rotation={rotation}
					axialTilt={axialTilt}
					fresnelConfig={fresnelConfig}
					pointCount={pointCount}
					landPointColor={landPointColor}
					pointSize={pointSize}
					autoRotate={autoRotate}
					lockedPolarAngle={lockedPolarAngle}
					markers={markers}
					markerTooltip={markerTooltip}
					onMarkerClick={onMarkerClick}
					onBackgroundClick={onBackgroundClick}
					focusOn={focusOn}
				/>
			</div>
		</div>
	);
}

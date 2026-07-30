import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2, Vec3 } from 'ogl';
import { animate } from 'motion';
import landTextureUrl from '../../assets/land-texture.png';
import { type ColorRepresentation, toLinearRgb } from '../../lib/color';
import type { GlobeMarker, GlobeMarkerTooltipRenderer } from './types';
import GlobeMarkerItem from './GlobeMarkerItem';

interface FresnelConfig {
	/**
	 * Base body color for the globe surface.
	 * @default "#111113"
	 */
	color?: ColorRepresentation;
	/**
	 * Accent color applied by the Fresnel rim.
	 * @default "#FF6900"
	 */
	rimColor?: ColorRepresentation;
	/**
	 * Controls how tight the Fresnel rim hug is.
	 * Higher values yield a thinner outline.
	 * @default 6
	 */
	rimPower?: number;
	/**
	 * Intensity multiplier for the Fresnel rim color.
	 * @default 1.5
	 */
	rimIntensity?: number;
}

interface Props {
	/**
	 * Scale multiplier for the globe field.
	 * @default 1
	 */
	scale?: number;
	/**
	 * Horizontal globe offset in normalized viewport units.
	 * @default 0
	 */
	offsetX?: number;
	/**
	 * Vertical globe offset in normalized viewport units.
	 * @default 0
	 */
	offsetY?: number;
	/**
	 * Globe field rotation in degrees.
	 * @default 0
	 */
	rotation?: number;
	/**
	 * Optional overrides for the Fresnel shader uniforms.
	 */
	fresnelConfig?: FresnelConfig;
	/**
	 * Number of points rendered along the globe surface.
	 * @default 15000
	 */
	pointCount?: number;
	/**
	 * Size of each point in world units.
	 * @default 0.05
	 */
	pointSize?: number;
	/**
	 * Color applied to points representing land.
	 * @default "#f77114"
	 */
	landPointColor?: ColorRepresentation;
	/**
	 * Whether the globe should auto-rotate.
	 * @default true
	 */
	autoRotate?: boolean;
	/**
	 * Whether to lock the camera's polar angle.
	 * @default true
	 */
	lockedPolarAngle?: boolean;
	/**
	 * Markers to display on the globe.
	 */
	markers?: GlobeMarker[];
	/**
	 * Optional custom tooltip renderer.
	 */
	markerTooltip?: GlobeMarkerTooltipRenderer;
	/**
	 * Called when a marker's tooltip/label is clicked. When provided, tooltips
	 * become clickable hit targets (same interaction as clicking a location
	 * in an external location list).
	 */
	onMarkerClick?: (marker: GlobeMarker, index: number) => void;
	/**
	 * Called when the canvas background is tapped/clicked directly — a plain
	 * tap, not a drag-to-rotate gesture. Marker tooltips are separate DOM
	 * elements layered on top of the canvas, so clicking one never reaches
	 * this handler regardless of where it sits on the globe.
	 */
	onBackgroundClick?: () => void;
	/**
	 * Called when the canvas background is double-tapped (touch only — mouse
	 * double-clicks are ignored). Fires instead of a second onBackgroundClick
	 * call for that tap, not in addition to it.
	 */
	onDoubleTap?: () => void;
	/**
	 * Coordinates [lat, lon] to focus on.
	 */
	focusOn?: [number, number] | null;
	/**
	 * Tilt of the sphere's own polar axis, in degrees, relative to the
	 * fixed spin axis. Purely cosmetic — like Earth's 23.4° axial tilt,
	 * it makes autorotate trace a wobble instead of a perfectly upright spin.
	 * @default 0
	 */
	axialTilt?: number;
}

interface ProjectedMarker {
	marker: GlobeMarker;
	index: number;
	screenX: number;
	screenY: number;
	visibility: number;
}

interface UniformUpdaterState {
	scale: number;
	offsetX: number;
	offsetY: number;
	rotation: number;
	axialTilt: number;
	pointCount: number;
	pointSize: number;
	landPointColor: ColorRepresentation;
	fresnelConfig: Required<FresnelConfig>;
}

const PI = Math.PI;
const DEG2RAD = PI / 180;
const EPSILON = 1e-6;
const COBE_GLOBE_RADIUS = 0.8;
const DEFAULT_GLOBE_SCALE = 1;
const AUTO_ROTATE_SPEED = (2 * PI) / 45;
const ROTATE_SENSITIVITY = 0.005;
const SMOOTHING_STRENGTH = 14;
const LOCKED_POLAR_ANGLE = 1.5;
const LOCKED_THETA = Math.asin(Math.cos(LOCKED_POLAR_ANGLE));
const MIN_THETA = -PI * 0.5 + 0.001;
const MAX_THETA = PI * 0.5 - 0.001;
const VISIBILITY_MIN_DOT = 0.24;
const VISIBILITY_MAX_DOT = 0.48;
const MAX_SHADER_MARKERS = 128;
const SHADER_MARKER_SIZE_SCALE = 0.3;
const MIN_SHADER_MARKER_SIZE = 0.003;
const MAX_SHADER_MARKER_SIZE = 0.06;
const FOCUS_TWEEN_DURATION = 0.5;
const FOCUS_TWEEN_EASE = 'easeInOut';
// A second tap within this time and distance of the first counts as a
// double-tap rather than two separate taps.
const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE = 24;

const defaultFresnelConfig: Required<FresnelConfig> = {
	color: '#17181A',
	rimColor: '#FF6900',
	rimPower: 6,
	rimIntensity: 1.5
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampTheta = (value: number, lockPolar: boolean) =>
	lockPolar ? LOCKED_THETA : clamp(value, MIN_THETA, MAX_THETA);

const smoothstep = (value: number, edge0: number, edge1: number) => {
	if (Math.abs(edge1 - edge0) <= EPSILON) {
		return value >= edge1 ? 1 : 0;
	}
	const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
};

const toPointRadius = (nextPointSize: number) => Math.max(0.001, nextPointSize * 0.16);

function normalizeAngle(value: number): number {
	const wrapped = (((value + PI) % (2 * PI)) + 2 * PI) % (2 * PI);
	return wrapped - PI;
}

function shortestAngleTarget(current: number, next: number): number {
	const delta = normalizeAngle(next - current);
	return current + delta;
}

// Mirrors the `tiltAxis` GLSL helper. Marker/focus math works backwards
// from the fragment shader's tilted globePoint, so it applies the
// inverse (negative) angle before feeding into the untilted phi/theta math.
function tiltAxis(x: number, y: number, z: number, angle: number) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x, y: c * y - s * z, z: s * y + c * z };
}

function lonLatToCartesian(lon: number, lat: number, r: number) {
	const lonRad = lon * DEG2RAD;
	const latRad = lat * DEG2RAD;

	const y = r * Math.sin(latRad);
	const rXZ = r * Math.cos(latRad);
	const x = rXZ * Math.sin(lonRad);
	const z = rXZ * Math.cos(lonRad);

	return { x, y, z };
}

function cartesianToRotation(x: number, y: number, z: number) {
	const length = Math.hypot(x, y, z);
	if (length <= EPSILON) {
		return { phi: 0, theta: 0 };
	}
	const nx = x / length;
	const ny = y / length;
	const nz = z / length;

	return {
		phi: Math.atan2(-nx, nz),
		theta: Math.asin(clamp(ny, -1, 1))
	};
}

function applyRotation(x: number, y: number, z: number, phi: number, theta: number) {
	const cx = Math.cos(theta);
	const cy = Math.cos(phi);
	const sx = Math.sin(theta);
	const sy = Math.sin(phi);

	return {
		rx: cy * x + sy * z,
		ry: sy * sx * x + cx * y - cy * sx * z,
		rz: -sy * cx * x + sx * y + cy * cx * z
	};
}

function cubicBezierAt(t: number, p0: number, p1: number, p2: number, p3: number): number {
	const u = 1 - t;
	return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function cubicBezierDerivativeAt(
	t: number,
	p0: number,
	p1: number,
	p2: number,
	p3: number
): number {
	const u = 1 - t;
	return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function dynamicEase(value: number): number {
	const clamped = clamp(value, 0, 1);
	let t = clamped;
	for (let i = 0; i < 5; i++) {
		const x = cubicBezierAt(t, 0, 0.625, 0, 1);
		const dx = cubicBezierDerivativeAt(t, 0, 0.625, 0, 1);
		if (Math.abs(dx) < 1e-6) break;
		t = clamp(t - (x - clamped) / dx, 0, 1);
	}
	return cubicBezierAt(t, 0, 0.05, 1, 1);
}

function applyDisplayTransform(
	x: number,
	y: number,
	aspect: number,
	scale: number,
	rotation: number,
	offsetX: number,
	offsetY: number
) {
	const nextScale = Math.max(0.001, scale);
	const angle = rotation * DEG2RAD;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const ax = x * aspect * nextScale;
	const ay = y * nextScale;

	return {
		x: (ax * cos - ay * sin + offsetX * aspect * 2) / aspect,
		y: ax * sin + ay * cos + offsetY * 2
	};
}

export default function GlobeScene({
	scale = 1,
	offsetX = 0,
	offsetY = 0,
	rotation = 0,
	axialTilt = 0,
	fresnelConfig = {},
	pointCount = 15000,
	pointSize = 0.05,
	landPointColor = '#f77114',
	autoRotate = true,
	lockedPolarAngle = true,
	markers = [],
	markerTooltip,
	onMarkerClick,
	onBackgroundClick,
	onDoubleTap,
	focusOn = null
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [projectedMarkers, setProjectedMarkers] = useState<ProjectedMarker[]>([]);

	const resolvedFresnelConfig: Required<FresnelConfig> = useMemo(
		() => ({
			...defaultFresnelConfig,
			...fresnelConfig
		}),
		[fresnelConfig]
	);

	const updateUniformsRef = useRef<((state: UniformUpdaterState) => void) | null>(null);
	const syncFocusTargetRef = useRef<((target: [number, number] | null) => void) | null>(null);

	// The RAF loop and pointer/focus handlers below live inside a mount-only
	// effect, so they close over whichever prop values were current at mount
	// time. This ref is kept fresh every render so those closures can read
	// live prop values instead of a stale mount-time snapshot.
	const latestRef = useRef({
		scale,
		offsetX,
		offsetY,
		rotation,
		axialTilt,
		lockedPolarAngle,
		autoRotate,
		markers,
		onBackgroundClick,
		onDoubleTap
	});
	useEffect(() => {
		latestRef.current = {
			scale,
			offsetX,
			offsetY,
			rotation,
			axialTilt,
			lockedPolarAngle,
			autoRotate,
			markers,
			onBackgroundClick,
			onDoubleTap
		};
	});

	useEffect(() => {
		updateUniformsRef.current?.({
			scale,
			offsetX,
			offsetY,
			rotation,
			axialTilt,
			pointCount,
			pointSize,
			landPointColor,
			fresnelConfig: resolvedFresnelConfig
		});
	}, [
		scale,
		offsetX,
		offsetY,
		rotation,
		axialTilt,
		pointCount,
		pointSize,
		landPointColor,
		resolvedFresnelConfig
	]);

	useEffect(() => {
		syncFocusTargetRef.current?.(focusOn);
	}, [focusOn]);

	useEffect(() => {
		const targetCanvas = canvasRef.current;
		if (!targetCanvas) return;

		const renderer = new Renderer({
			canvas: targetCanvas,
			alpha: true,
			antialias: true,
			dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1
		});
		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 0);

		targetCanvas.style.width = '100%';
		targetCanvas.style.height = '100%';

		const camera = new Camera(gl);
		camera.position.z = 1;

		const globeScene = new Transform();
		const geometry = new Triangle(gl);
		const markerData = new Array<number>(MAX_SHADER_MARKERS * 4).fill(0);
		const markerColorData = new Array<number>(MAX_SHADER_MARKERS * 3).fill(0);
		const landTexture = new Texture(gl, {
			image: new Uint8Array([0, 0, 0, 255]),
			width: 1,
			height: 1,
			format: gl.RGBA,
			type: gl.UNSIGNED_BYTE,
			minFilter: gl.NEAREST,
			magFilter: gl.NEAREST,
			generateMipmaps: false,
			wrapS: gl.REPEAT,
			wrapT: gl.REPEAT
		});

		const uniforms = {
			uTime: { value: 0 },
			uResolution: { value: new Vec2(1, 1) },
			uRotation: { value: new Vec2(0, clampTheta(0, lockedPolarAngle)) },
			uAxialTilt: { value: axialTilt * DEG2RAD },
			uScale: { value: DEFAULT_GLOBE_SCALE },
			uDisplayScale: { value: scale },
			uDisplayOffset: { value: new Vec2(offsetX, offsetY) },
			uDisplayRotation: { value: rotation },
			uDots: { value: Math.max(1, Math.floor(pointCount)) },
			uPointRadius: { value: toPointRadius(pointSize) },
			uBaseColor: { value: new Vec3(0, 0, 0) },
			uRimColor: { value: new Vec3(0, 0, 0) },
			uRimPower: { value: resolvedFresnelConfig.rimPower },
			uRimIntensity: { value: resolvedFresnelConfig.rimIntensity },
			uLandPointColor: { value: new Vec3(0, 0, 0) },
			uLandTexture: { value: landTexture },
			uMarkerCount: { value: 0 },
			uMarkerData: { value: markerData },
			uMarkerColor: { value: markerColorData }
		};

		const vertexShader = `
			attribute vec2 uv;
			attribute vec2 position;
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = vec4(position, 0.0, 1.0);
			}
		`;

		const globeFragmentShader = `
			precision highp float;

			varying vec2 vUv;

			uniform float uTime;
			uniform vec2 uResolution;
			uniform vec2 uRotation;
			uniform float uAxialTilt;
			uniform float uScale;
			uniform float uDisplayScale;
			uniform vec2 uDisplayOffset;
			uniform float uDisplayRotation;
			uniform float uDots;
			uniform float uPointRadius;
			uniform vec3 uBaseColor;
			uniform vec3 uRimColor;
			uniform float uRimPower;
			uniform float uRimIntensity;
			uniform vec3 uLandPointColor;
			uniform sampler2D uLandTexture;
			uniform float uMarkerCount;
			uniform vec4 uMarkerData[${MAX_SHADER_MARKERS}];
			uniform vec3 uMarkerColor[${MAX_SHADER_MARKERS}];

			const float kPi = 3.141592653589793;
			const float kTau = 6.283185307179586;
			const float kPhi = 1.618033988749895;
			const float kSqrt5 = 2.23606797749979;
			const float kSphereRadius = 0.8;
			const int kMaxMarkers = ${MAX_SHADER_MARKERS};

			float byDots;

			vec2 rotate2(vec2 p, float angle) {
				float c = cos(angle);
				float s = sin(angle);
				return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
			}

			// Tilts the sphere's own polar axis relative to the (fixed) spin
			// axis driven by uRotation, so autorotate traces the classic
			// off-axis "planet" wobble instead of a perfectly upright spin.
			vec3 tiltAxis(vec3 p, float angle) {
				float c = cos(angle);
				float s = sin(angle);
				return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
			}

			vec2 transformUv(vec2 uv) {
				float aspect = uResolution.x / max(1.0, uResolution.y);
				vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
				vec2 transformed = rotate2(
					centered - vec2(uDisplayOffset.x * aspect, uDisplayOffset.y),
					-radians(uDisplayRotation)
				) / max(uDisplayScale, 0.001);
				return vec2(transformed.x / aspect + 0.5, transformed.y + 0.5);
			}

			mat3 rotate(float theta, float phi) {
				float cx = cos(theta);
				float cy = cos(phi);
				float sx = sin(theta);
				float sy = sin(phi);
				return mat3(
					cy, sy * sx, -sy * cx,
					0.0, cx, sx,
					sy, cy * -sx, cy * cx
				);
			}

			vec3 nearestFibonacciLattice(vec3 p, out float m) {
				p = p.xzy;

				float k = max(2.0, floor(log2(kSqrt5 * uDots * kPi * (1.0 - p.z * p.z)) * 0.72021));
				vec2 f = floor(pow(kPhi, k) / kSqrt5 * vec2(1.0, kPhi) + 0.5);
				vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;
				vec2 br2 = -2.0 * f;
				vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
				vec2 c = floor(vec2(
					br2.y * sp.x - br1.y * (sp.y * uDots + 1.0),
					-br2.x * sp.x + br1.x * (sp.y * uDots + 1.0)
				) / (br1.x * br2.y - br2.x * br1.y));

				float mindist = kPi;
				vec3 minip = vec3(0.0, 0.0, 1.0);

				for (float s = 0.0; s < 4.0; s += 1.0) {
					vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
					float idx = dot(f, c + o);
					if (idx > uDots) continue;

					float a = idx;
					float b = 0.0;
					if (a >= 4194304.0) a -= 4194304.0, b += 0.431150;
					if (a >= 2097152.0) a -= 2097152.0, b += 0.215575;
					if (a >= 1048576.0) a -= 1048576.0, b += 0.607787;
					if (a >= 524288.0) a -= 524288.0, b += 0.803894;
					if (a >= 262144.0) a -= 262144.0, b += 0.901947;
					if (a >= 131072.0) a -= 131072.0, b += 0.950973;
					if (a >= 65536.0) a -= 65536.0, b += 0.475487;
					if (a >= 32768.0) a -= 32768.0, b += 0.737743;
					if (a >= 16384.0) a -= 16384.0, b += 0.868872;
					if (a >= 8192.0) a -= 8192.0, b += 0.934436;
					if (a >= 4096.0) a -= 4096.0, b += 0.467218;
					if (a >= 2048.0) a -= 2048.0, b += 0.733609;
					if (a >= 1024.0) a -= 1024.0, b += 0.866804;
					if (a >= 512.0) a -= 512.0, b += 0.433402;
					if (a >= 256.0) a -= 256.0, b += 0.216701;
					if (a >= 128.0) a -= 128.0, b += 0.108351;
					if (a >= 64.0) a -= 64.0, b += 0.554175;
					if (a >= 32.0) a -= 32.0, b += 0.777088;
					if (a >= 16.0) a -= 16.0, b += 0.888544;
					if (a >= 8.0) a -= 8.0, b += 0.944272;
					if (a >= 4.0) a -= 4.0, b += 0.472136;
					if (a >= 2.0) a -= 2.0, b += 0.236068;
					if (a >= 1.0) a -= 1.0, b += 0.618034;

					float theta = fract(b) * kTau;
					float cosphi = 1.0 - 2.0 * idx * byDots;
					float sinphi = sqrt(max(0.0, 1.0 - cosphi * cosphi));
					vec3 samplePoint = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);

					float dist = length(p - samplePoint);
					if (dist < mindist) {
						mindist = dist;
						minip = samplePoint;
					}
				}

				m = mindist;
				return minip.xzy;
			}

			vec2 pointToMaskUV(vec3 p) {
				float lengthP = length(p);
				if (lengthP <= 0.0) {
					return vec2(0.0, 0.0);
				}

				vec3 n = p / lengthP;

				float nx = n.z;
				float ny = n.y;
				float nz = -n.x;

				float gPhi = asin(clamp(ny, -1.0, 1.0));
				float cosPhi = cos(gPhi);

				float gTheta = 0.0;
				if (abs(cosPhi) > 1e-6) {
					float thetaInput = clamp(-nx / cosPhi, -1.0, 1.0);
					gTheta = acos(thetaInput);
					if (nz < 0.0) {
						gTheta = -gTheta;
					}
				}

				return vec2(
					fract((gTheta * 0.5) / kPi),
					fract(gPhi / kPi + 0.5)
				);
			}

			vec3 linearToSrgb(vec3 color) {
				vec3 safe = max(color, vec3(0.0));
				vec3 low = safe * 12.92;
				vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
				vec3 cutoff = step(vec3(0.0031308), safe);
				return mix(low, high, cutoff);
			}

			void main() {
				byDots = 1.0 / max(1.0, uDots);

				vec2 uv = transformUv(vUv) * 2.0 - 1.0;
				uv.x *= uResolution.x / max(1.0, uResolution.y);
				uv /= max(0.0001, uScale);

				float l = dot(uv, uv);
				float globeR2 = kSphereRadius * kSphereRadius;

				vec3 color = vec3(0.0);
				float alpha = 0.0;

				if (l <= globeR2) {
					float dis;
					vec3 p = normalize(vec3(uv, sqrt(max(0.0, globeR2 - l))));
					mat3 rot = rotate(uRotation.y, uRotation.x);
					vec3 globePoint = tiltAxis(p * rot, uAxialTilt);
					vec3 samplePoint = nearestFibonacciLattice(globePoint, dis);
					vec2 mapUv = pointToMaskUV(samplePoint);
					float land = texture2D(uLandTexture, mapUv).r;

					float dotRadius = uPointRadius * 0.6;
					float edgeFeather = dotRadius * 0.25;
					float landDots = step(0.5, land) * (1.0 - smoothstep(dotRadius - edgeFeather, dotRadius, dis));

					float dotNV = clamp(p.z / kSphereRadius, 0.0, 1.0);
					float rim = pow(1.0 - dotNV, max(0.0001, uRimPower)) * uRimIntensity;
					// Match the geometric foreshortening from the old instanced point mesh:
					// near the silhouette points should visually fade instead of staying fully crisp.
					float dotFade = smoothstep(0.04, 0.28, dotNV);
					landDots *= dotFade;

					vec3 markerColor = vec3(0.0);
					float markerMask = 0.0;
					float markerWeightSum = 0.0;
					for (int i = 0; i < kMaxMarkers; i++) {
						if (float(i) >= uMarkerCount) {
							break;
						}

						vec4 marker = uMarkerData[i];
						float markerDist = length(globePoint - marker.xyz);
						float markerCore = smoothstep(marker.w, marker.w * 0.9, markerDist);
						float pulse = fract(uTime * 0.85 + float(i) * 0.173);
						float pulseRadius = marker.w * mix(1.15, 2.8, pulse);
						float pulseWidth = marker.w * 0.12;
						float pulseInner = smoothstep(
							pulseRadius - pulseWidth,
							pulseRadius,
							markerDist
						);
						float pulseOuter =
							1.0 - smoothstep(pulseRadius, pulseRadius + pulseWidth, markerDist);
						float markerPulse = pulseInner * pulseOuter * (1.0 - pulse);
						float markerDot = max(markerCore, markerPulse * 0.72);
						markerMask = max(markerMask, markerDot);
						markerWeightSum += markerDot;
						markerColor += uMarkerColor[i] * markerDot;
					}

					if (markerWeightSum > 0.0) {
						markerColor /= markerWeightSum;
					}

					vec3 surface = uBaseColor;
					surface += uRimColor * rim;
					surface = mix(surface, uLandPointColor, landDots * (1.0 - markerMask));

					// Keep marker color clean and dominant over land dots.
					vec3 boostedMarker = markerColor * (1.0 + 0.25 * markerMask);
					surface = mix(surface, boostedMarker, markerMask);

					color += surface;
					alpha = 1.0;
				}

				gl_FragColor = vec4(linearToSrgb(color), clamp(alpha, 0.0, 1.0));
			}
		`;

		const globeProgram = new Program(gl, {
			vertex: vertexShader,
			fragment: globeFragmentShader,
			uniforms,
			transparent: true,
			depthTest: false,
			depthWrite: false
		});

		const globeMesh = new Mesh(gl, {
			geometry,
			program: globeProgram,
			frustumCulled: false
		});
		globeMesh.setParent(globeScene);

		let currentScale = DEFAULT_GLOBE_SCALE;
		const tempColor = new Vec3();
		const setColor = (
			target: Vec3,
			value: ColorRepresentation,
			fallback: [number, number, number]
		) => {
			const [r, g, b] = toLinearRgb(value, fallback);
			target.set(r, g, b);
		};

		const updateUniforms = (state: UniformUpdaterState) => {
			currentScale = DEFAULT_GLOBE_SCALE;
			uniforms.uScale.value = currentScale;
			uniforms.uDisplayScale.value = Math.max(0.001, state.scale);
			uniforms.uDisplayOffset.value.set(state.offsetX, state.offsetY);
			uniforms.uDisplayRotation.value = state.rotation;
			uniforms.uAxialTilt.value = state.axialTilt * DEG2RAD;
			uniforms.uDots.value = Math.max(1, Math.floor(state.pointCount));
			uniforms.uPointRadius.value = toPointRadius(state.pointSize);

			setColor(uniforms.uBaseColor.value, state.fresnelConfig.color, [
				17 / 255,
				17 / 255,
				19 / 255
			]);
			setColor(uniforms.uRimColor.value, state.fresnelConfig.rimColor, [1, 105 / 255, 0]);
			uniforms.uRimPower.value = Math.max(0.0001, state.fresnelConfig.rimPower);
			uniforms.uRimIntensity.value = Math.max(0, state.fresnelConfig.rimIntensity);

			setColor(tempColor, state.landPointColor, [247 / 255, 113 / 255, 20 / 255]);
			uniforms.uLandPointColor.value.set(tempColor.x, tempColor.y, tempColor.z);
		};
		updateUniformsRef.current = updateUniforms;

		updateUniforms({
			scale,
			offsetX,
			offsetY,
			rotation,
			axialTilt,
			pointCount,
			pointSize,
			landPointColor,
			fresnelConfig: resolvedFresnelConfig
		});

		let width = 1;
		let height = 1;

		const startTheta = clampTheta(0, lockedPolarAngle);
		let phi = 0;
		let theta = startTheta;
		let targetPhi = phi;
		let targetTheta = startTheta;

		// While true, tick()'s per-frame theta clamp is bypassed so the
		// un-focus tween below can ease theta back to LOCKED_THETA on the same
		// curve as the focus-in tween, instead of snapping back instantly.
		let returningToDefault = false;
		let focusAnimation: { stop: () => void } | null = null;

		const syncMarkers = (currentPhi: number, currentTheta: number, currentScaleValue: number) => {
			const live = latestRef.current;
			const markerRadius = COBE_GLOBE_RADIUS;
			const aspect = width / Math.max(1, height);
			const markerCount = Math.min(live.markers.length, MAX_SHADER_MARKERS);
			markerData.fill(0);
			markerColorData.fill(0);
			uniforms.uMarkerCount.value = markerCount;

			const axialTiltRad = live.axialTilt * DEG2RAD;
			const nextMarkers: ProjectedMarker[] = [];
			for (let index = 0; index < live.markers.length; index++) {
				const marker = live.markers[index];
				const pos = lonLatToCartesian(marker.location[1], marker.location[0], markerRadius);
				const detilted = tiltAxis(pos.x, pos.y, pos.z, -axialTiltRad);
				const rotated = applyRotation(detilted.x, detilted.y, detilted.z, currentPhi, currentTheta);

				const ndcX = (rotated.rx / aspect) * currentScaleValue;
				const ndcY = rotated.ry * currentScaleValue;
				const transformed = applyDisplayTransform(
					ndcX,
					ndcY,
					aspect,
					live.scale,
					live.rotation,
					live.offsetX,
					live.offsetY
				);
				const screenX = (transformed.x + 1) * 0.5;
				const screenY = (-transformed.y + 1) * 0.5;

				const frontDot = rotated.rz / markerRadius;
				const rawVisibility = smoothstep(frontDot, VISIBILITY_MIN_DOT, VISIBILITY_MAX_DOT);
				const visibility = dynamicEase(rawVisibility);

				nextMarkers.push({
					marker,
					index,
					screenX,
					screenY,
					visibility
				});

				if (index >= markerCount) continue;

				const unitPos = lonLatToCartesian(marker.location[1], marker.location[0], 1);
				const markerDataOffset = index * 4;
				markerData[markerDataOffset] = unitPos.x;
				markerData[markerDataOffset + 1] = unitPos.y;
				markerData[markerDataOffset + 2] = unitPos.z;
				markerData[markerDataOffset + 3] = clamp(
					(marker.size ?? 0.05) * SHADER_MARKER_SIZE_SCALE,
					MIN_SHADER_MARKER_SIZE,
					MAX_SHADER_MARKER_SIZE
				);

				const [r, g, b] = toLinearRgb(marker.color ?? '#ffffff', [1, 1, 1]);
				const markerColorOffset = index * 3;
				markerColorData[markerColorOffset] = r;
				markerColorData[markerColorOffset + 1] = g;
				markerColorData[markerColorOffset + 2] = b;
			}

			setProjectedMarkers(nextMarkers);
		};

		const syncFocusTarget = (target: [number, number] | null) => {
			focusAnimation?.stop();
			focusAnimation = null;

			const live = latestRef.current;

			if (!target) {
				returningToDefault = true;
				const startTheta = targetTheta;
				const controls = animate(startTheta, LOCKED_THETA, {
					duration: FOCUS_TWEEN_DURATION,
					ease: FOCUS_TWEEN_EASE,
					onUpdate: (latest) => {
						targetTheta = latest;
					},
					onComplete: () => {
						returningToDefault = false;
					}
				});
				focusAnimation = { stop: () => controls.stop() };
				return;
			}

			returningToDefault = false;
			const [lat, lon] = target;
			const nextDirection = lonLatToCartesian(lon, lat, 1);
			const detilted = tiltAxis(
				nextDirection.x,
				nextDirection.y,
				nextDirection.z,
				-live.axialTilt * DEG2RAD
			);
			const targetRotation = cartesianToRotation(detilted.x, detilted.y, detilted.z);

			const desiredTheta = clampTheta(targetRotation.theta, live.lockedPolarAngle);
			const desiredPhi = shortestAngleTarget(targetPhi, targetRotation.phi);

			const startPhi = targetPhi;
			const startTheta = targetTheta;
			const phiControls = animate(startPhi, desiredPhi, {
				duration: FOCUS_TWEEN_DURATION,
				ease: FOCUS_TWEEN_EASE,
				onUpdate: (latest) => {
					targetPhi = latest;
				}
			});
			const thetaControls = animate(startTheta, desiredTheta, {
				duration: FOCUS_TWEEN_DURATION,
				ease: FOCUS_TWEEN_EASE,
				onUpdate: (latest) => {
					targetTheta = clampTheta(latest, latestRef.current.lockedPolarAngle);
				}
			});
			focusAnimation = {
				stop: () => {
					phiControls.stop();
					thetaControls.stop();
				}
			};
		};
		syncFocusTargetRef.current = syncFocusTarget;

		syncFocusTarget(focusOn);

		// A pointer session that never moves more than this many pixels between
		// down and up reads as a tap/click rather than a drag-to-rotate gesture.
		const TAP_DISTANCE_THRESHOLD = 6;

		let dragging = false;
		let activePointerId = -1;
		let lastPointerX = 0;
		let lastPointerY = 0;
		let dragDistance = 0;

		// Tracks the most recent tap (touch only) to detect a double-tap: a
		// second tap close enough in time and position to the first.
		let lastTapTime = 0;
		let lastTapX = 0;
		let lastTapY = 0;

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			dragging = true;
			activePointerId = event.pointerId;
			lastPointerX = event.clientX;
			lastPointerY = event.clientY;
			dragDistance = 0;
			targetCanvas.setPointerCapture(event.pointerId);
			focusAnimation?.stop();
			focusAnimation = null;
			returningToDefault = false;
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!dragging || event.pointerId !== activePointerId) return;
			const dx = event.clientX - lastPointerX;
			const dy = event.clientY - lastPointerY;
			lastPointerX = event.clientX;
			lastPointerY = event.clientY;
			dragDistance += Math.hypot(dx, dy);

			targetPhi += dx * ROTATE_SENSITIVITY;
			targetTheta = clampTheta(
				targetTheta + dy * ROTATE_SENSITIVITY,
				latestRef.current.lockedPolarAngle
			);
		};

		const onPointerUp = (event: PointerEvent) => {
			if (event.pointerId !== activePointerId) return;
			const wasTap = dragging && dragDistance < TAP_DISTANCE_THRESHOLD;
			dragging = false;
			activePointerId = -1;
			if (!wasTap) return;

			if (event.pointerType === 'touch') {
				const dx = event.clientX - lastTapX;
				const dy = event.clientY - lastTapY;
				const isDoubleTap =
					event.timeStamp - lastTapTime <= DOUBLE_TAP_MAX_INTERVAL_MS &&
					Math.hypot(dx, dy) <= DOUBLE_TAP_MAX_DISTANCE;

				if (isDoubleTap) {
					lastTapTime = 0;
					latestRef.current.onDoubleTap?.();
					return;
				}

				lastTapTime = event.timeStamp;
				lastTapX = event.clientX;
				lastTapY = event.clientY;
			}

			latestRef.current.onBackgroundClick?.();
		};

		const stopDragging = (event: PointerEvent) => {
			if (event.pointerId !== activePointerId) return;
			dragging = false;
			activePointerId = -1;
		};

		targetCanvas.addEventListener('pointerdown', onPointerDown);
		targetCanvas.addEventListener('pointermove', onPointerMove);
		targetCanvas.addEventListener('pointerup', onPointerUp);
		targetCanvas.addEventListener('pointercancel', stopDragging);
		targetCanvas.addEventListener('lostpointercapture', stopDragging);

		let disposed = false;
		const image = new Image();
		image.onload = () => {
			if (disposed) return;
			landTexture.image = image;
			landTexture.generateMipmaps = false;
			landTexture.minFilter = gl.NEAREST;
			landTexture.magFilter = gl.NEAREST;
			landTexture.needsUpdate = true;
		};
		image.onerror = (error) => {
			console.warn('GlobeScene: failed to load land mask texture', error);
		};
		image.src = landTextureUrl;

		let raf = 0;
		let previous = 0;
		const tick = (now: number) => {
			const live = latestRef.current;
			const w = Math.max(1, targetCanvas.clientWidth);
			const h = Math.max(1, targetCanvas.clientHeight);
			const bufW = Math.round(w * renderer.dpr);
			const bufH = Math.round(h * renderer.dpr);
			if (targetCanvas.width !== bufW || targetCanvas.height !== bufH) {
				targetCanvas.width = bufW;
				targetCanvas.height = bufH;
				renderer.width = w;
				renderer.height = h;
				renderer.state.viewport = { x: 0, y: 0, width: null, height: null };
				width = w;
				height = h;
				uniforms.uResolution.value.set(w, h);
			}
			const delta = previous ? (now - previous) / 1000 : 0;
			previous = now;
			uniforms.uTime.value += delta;

			if (live.autoRotate) {
				targetPhi -= AUTO_ROTATE_SPEED * delta;
			}
			targetTheta = clampTheta(targetTheta, live.lockedPolarAngle && !returningToDefault);

			const easing = 1 - Math.exp(-delta * SMOOTHING_STRENGTH);
			phi += (targetPhi - phi) * easing;
			theta += (targetTheta - theta) * easing;

			uniforms.uRotation.value.set(phi, theta);

			syncMarkers(phi, theta, currentScale);
			renderer.render({ scene: globeScene, camera, clear: true });
			raf = window.requestAnimationFrame(tick);
		};

		raf = window.requestAnimationFrame(tick);

		return () => {
			disposed = true;
			focusAnimation?.stop();
			focusAnimation = null;
			window.cancelAnimationFrame(raf);
			targetCanvas.removeEventListener('pointerdown', onPointerDown);
			targetCanvas.removeEventListener('pointermove', onPointerMove);
			targetCanvas.removeEventListener('pointerup', onPointerUp);
			targetCanvas.removeEventListener('pointercancel', stopDragging);
			targetCanvas.removeEventListener('lostpointercapture', stopDragging);

			globeMesh.setParent(null);
			geometry.remove();
			globeProgram.remove();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			<canvas
				ref={canvasRef}
				className="absolute inset-0 block h-full w-full"
				style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
				aria-hidden="true"
			/>
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				{projectedMarkers.map((projected, i) => {
					const isSelected =
						focusOn !== null &&
						projected.marker.location[0] === focusOn[0] &&
						projected.marker.location[1] === focusOn[1];
					return (
						<GlobeMarkerItem
							key={projected.marker.label || i}
							marker={projected.marker}
							index={projected.index}
							screenX={projected.screenX}
							screenY={projected.screenY}
							visibility={projected.visibility}
							tooltip={markerTooltip}
							isSelected={isSelected}
							onSelect={
								onMarkerClick ? () => onMarkerClick(projected.marker, projected.index) : undefined
							}
						/>
					);
				})}
			</div>
		</>
	);
}

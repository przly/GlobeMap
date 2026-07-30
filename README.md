# Globe

An interactive WebGL globe (dot-matrix landmass, location markers, tap/drag
rotation) built with React, [ogl](https://github.com/oframe/ogl) and Vite.
`src/App.tsx` is the reference implementation — the marketing-site "Locations"
section from Figma — showing how to drive the reusable `<Globe />` component
for both desktop and mobile.

## Tech stack

- React 19 + TypeScript, built with Vite
- [ogl](https://github.com/oframe/ogl) — minimal WebGL renderer (no
  Three.js), used for the sphere shader and point lattice
- [motion](https://motion.dev) — spring/tween animation for zoom and
  focus-camera transitions
- Tailwind CSS 4

## Getting started

```sh
npm install
npm run dev      # start the dev server
npm run build     # production build
npm run preview   # preview the production build
npm run check     # tsc --noEmit
npm run lint      # prettier --check + eslint
```

## Project structure

```
src/
  App.tsx                      reference page — desktop/mobile orchestration lives here
  components/globe/
    Globe.tsx                  public component: sizes/positions the canvas, forwards props
    GlobeScene.tsx             the actual WebGL renderer, camera, pointer/gesture handling
    GlobeMarkerItem.tsx        one DOM-positioned marker pin + tooltip, projected from 3D
    types.ts                   GlobeMarker / tooltip renderer types
```

`Globe` is a thin wrapper: it sizes a `position: relative` container and
mounts `GlobeScene` inside it absolutely-positioned (`inset-0`), so the
canvas always fills whatever box you put `Globe` in. All the actual rendering
and gesture logic lives in `GlobeScene`.

## `<Globe />` props

| Prop                              | Type                                                  | What it does                                                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`                           | `number`                                              | Zoom level. Multiplies the sphere's on-screen size around the anchor point set by `offsetX`/`offsetY`.                                                                                               |
| `offsetX`, `offsetY`              | `number`                                              | Where the sphere is anchored on screen, in canvas-height-relative units (`0` = centered; positive `offsetY` = up, positive `offsetX` = right). Doesn't move the canvas — moves the sphere within it. |
| `rotation`                        | `number` (degrees)                                    | Rotates the whole display transform (sphere + markers) — a cosmetic tilt of the "camera", not the sphere's own spin.                                                                                 |
| `axialTilt`                       | `number` (degrees)                                    | Tilts the sphere's own spin axis, like Earth's 23.4° tilt — makes auto-rotate trace a wobble instead of a flat spin.                                                                                 |
| `pointCount`, `pointSize`         | `number`                                              | Density and size of the dot-matrix landmass lattice.                                                                                                                                                 |
| `landPointColor`, `fresnelConfig` | `string`, `{color, rimColor, rimPower, rimIntensity}` | Land dot color and the rim-light body/edge colors.                                                                                                                                                   |
| `markers`                         | `GlobeMarker[]`                                       | `{ location: [lat, lon], label, color, size }[]` — pins rendered on the sphere surface.                                                                                                              |
| `markerTooltip`                   | `(ctx) => ReactNode`                                  | Custom renderer for each marker's floating label.                                                                                                                                                    |
| `autoRotate`                      | `boolean`                                             | Whether the sphere spins on its own when idle.                                                                                                                                                       |
| `lockedPolarAngle`                | `boolean`                                             | `true` clamps vertical rotation to a fixed equatorial band (dragging only spins left/right); `false` frees vertical rotation too.                                                                    |
| `focusOn`                         | `[lat, lon] \| null`                                  | Animates the camera to face this coordinate; `null` returns to the default view.                                                                                                                     |
| `onMarkerClick`                   | `(marker, index) => void`                             | Fires when a marker's tooltip is tapped/clicked.                                                                                                                                                     |
| `onBackgroundClick`               | `() => void`                                          | Fires on a plain tap/click on empty globe (not a drag, not a marker).                                                                                                                                |
| `onDoubleTap`                     | `() => void`                                          | Fires on a touch double-tap on empty globe (mouse double-clicks are ignored). See below.                                                                                                             |

## Desktop vs. mobile implementation

Everything platform-specific lives in `App.tsx`, gated on one `useIsDesktop()`
hook (`window.matchMedia('(min-width: 1024px)')` — matches Tailwind's `lg:`
breakpoint). `GlobeScene` itself doesn't know or care which platform it's on;
it just reacts to whatever props it's given. **To port this to the final
site, replicate the prop values/gesture wiring below per breakpoint — the
component itself needs no changes.**

### Interaction model

| Gesture                                    | Desktop                                                                                                          | Mobile                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Drag (mouse / one finger)                  | Rotates left/right freely; vertical rotation locked to a narrow equatorial band **unless** a location is focused | Rotates freely on **both** axes, always — never locked                                                                  |
| Vertical one-finger swipe                  | n/a                                                                                                              | Scrolls the page (native), _not_ captured for rotation — only horizontal drag rotates                                   |
| Tap/click on a marker or location-list row | Focuses that location: camera turns to face it, zooms to `focusScale`                                            | Same                                                                                                                    |
| Tap/click on empty globe                   | Deselects the focused location, zooms back to `defaultScale`                                                     | Same                                                                                                                    |
| Double-tap on empty globe                  | n/a (not wired up)                                                                                               | Toggles zoom between `defaultScale` and `focusScale` — mobile's substitute for a pinch gesture, which isn't implemented |
| Idle                                       | Auto-rotates when nothing is focused                                                                             | Same                                                                                                                    |

This is wired up via two props that differ per breakpoint:

```tsx
lockedPolarAngle={isDesktop ? !focusOn : false}
onDoubleTap={isDesktop ? undefined : toggleDoubleTapZoom}
```

Passing `undefined` for `onDoubleTap` on desktop isn't just a no-op — it
keeps the feature mobile-only in intent, in case double-click behavior is
ever added for desktop separately.

### Zoom levels

Four constants at the top of `App.tsx` — this is the first place to look to
change how zoomed-in/out the globe is at rest or when focused:

```ts
const DESKTOP_DEFAULT_SCALE = 1.5; // resting zoom, desktop
const DESKTOP_FOCUS_SCALE = 3; // zoom when a location is selected, desktop
const MOBILE_DEFAULT_SCALE = 0.6; // resting zoom, mobile
const MOBILE_FOCUS_SCALE = 1.5; // zoom when a location is selected, mobile
```

Double-tap zoom (mobile) reuses `MOBILE_FOCUS_SCALE` — the same target the
focus-camera animates to when a location is tapped. Give double-tap its own
constant if it should zoom to a different level than selecting a location
does.

All zoom transitions (`selectLocation`, `deselectLocation`,
`toggleDoubleTapZoom`) animate through the same `animateScaleTo` helper
(0.5s ease-in-out via `motion`), so timing/easing stays consistent across
every trigger.

### Canvas framing

The `<Globe />` element's `className` differs per breakpoint:

```tsx
className={cn(
  'absolute top-0 left-[-15%] h-full w-[130%]',       // mobile
  'lg:inset-0 lg:top-auto lg:left-auto lg:h-full lg:w-full' // desktop
)}
```

**Mobile**: the canvas is oversized (130% width, shifted -15% left) and
always full-height/fixed-position — it never resizes or moves between the
default and focused states. Only `scale` (and the fixed `offsetY`) change,
so the globe visually grows/shrinks from the same anchor point instead of
the container sliding around. `offsetY = -0.3` (`MOBILE_OFFSET_Y`) anchors
the sphere low in the frame so it "peeks up" from the bottom of the card at
rest.

**Desktop**: the canvas is a plain `inset-0` fill of the card.
`offsetX = 1/6` shifts the sphere right, making room for the heading block
(bottom-left) and the locations panel (bottom-right), which are absolutely
positioned on top of the canvas — see the `lg:flex` blocks in `App.tsx`.

### Marker size

Marker pins are sized so they stay a constant _on-screen_ size regardless of
zoom level (`baseMarkerSize * (defaultScale / scale)` — shrinks as `scale`
grows past the resting default, growing back as it returns). Point/dot size
is intentionally left unscaled for the opposite reason — see the comment
above `basePointCount` in `App.tsx`.

### Scroll handling (mobile)

The canvas sets `touch-action: pan-y` (in `GlobeScene.tsx`), which lets the
browser handle vertical swipes as a native page scroll while leaving
horizontal drags for the rotate gesture — no custom gesture-direction
detection needed, the browser's touch-action disambiguation does it.

## Implementation checklist for porting to the production site

- [ ] Reuse the same `useIsDesktop()` / `(min-width: 1024px)` breakpoint (or
      whatever the production breakpoint system resolves to) to drive every
      prop listed above — don't hardcode one platform's values.
- [ ] Keep `lockedPolarAngle` and `onDoubleTap` platform-gated as shown; this
      is what makes mobile "freely rotate + double-tap zoom" and desktop
      "locked drag + click to focus" feel different despite sharing one
      component.
- [ ] Keep the mobile canvas fixed-size/position (no resizing on
      focus/unfocus) — that's what makes the zoom feel anchored instead of
      the globe jumping around the card.
- [ ] Carry over the `touch-action: pan-y` canvas style so page scroll keeps
      working through the globe on mobile.
- [ ] `MOBILE_OFFSET_Y` and the `-15%/130%` canvas sizing were tuned by eye
      against this Figma layout — re-tune them if the production card's
      aspect ratio differs.

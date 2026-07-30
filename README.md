# Globe

An interactive WebGL globe built with React, [ogl](https://github.com/oframe/ogl)
and Vite. `src/App.tsx` is the reference implementation — the marketing-site
"Locations" section from Figma.

The globe's own look and behavior (shader, rotation, zoom, gestures) is
self-contained inside `src/components/globe/` and isn't meant to change when
this gets ported into the production site. What **does** need replicating is
how the canvas is sized and positioned per breakpoint, and how it's fed
location data — that's what this README covers.

## Tech stack

- React 19 + TypeScript, built with Vite
- [ogl](https://github.com/oframe/ogl) — minimal WebGL renderer (no Three.js)
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
  App.tsx                      reference page — canvas positioning per breakpoint lives here
  components/globe/
    Globe.tsx                  public component: sizes/positions the canvas, forwards props
    GlobeScene.tsx             the WebGL renderer + gesture handling (self-contained, not for editing)
    GlobeMarkerItem.tsx        marker pin + tooltip (self-contained, not for editing)
```

`<Globe />` itself is a fixed API surface — pass it `scale`, `markers`,
`focusOn`, etc. and it renders. It fills whatever box its parent gives it
(`position: relative` wrapper, canvas at `inset-0`), so **all layout control
happens from the outside**, via the `className` and `offsetX`/`offsetY` props
passed to it — that's the part to replicate per breakpoint.

## Canvas implementation & positioning

`App.tsx` gates everything on one breakpoint check:

```ts
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
```

(matches Tailwind's `lg:` breakpoint — read via `window.matchMedia` in JS,
not a CSS class, because `offsetX`/`offsetY` are WebGL uniforms and can't be
gated behind a CSS breakpoint the way the `className` below can.)

### Mobile

```tsx
<Globe
  className="absolute top-0 left-[-15%] h-full w-[130%]"
  offsetX={0}
  offsetY={-0.3}
  ...
/>
```

The canvas is oversized (130% width, shifted -15% left so it stays centered)
and always full-height, filling its parent card completely. Critically, it
**never resizes or repositions** — not on mount, not when a location gets
selected/deselected. Only the `scale` prop animates. This is deliberate: an
earlier version resized the canvas itself between a "peek" state and a
"focused" state, which made the zoom feel like the globe was jumping around
the card. Keeping the canvas frame fixed and animating `scale`/`offsetY`
alone makes it feel like the globe zooms in place instead.

`offsetY={-0.3}` anchors the sphere low in the frame so it "peeks up" from
the bottom of the card. If the production card has a different aspect
ratio than the `aspect-[361/674]` used here, this value (and the
`-15%`/`130%` sizing) will likely need re-tuning by eye against the new
layout.

### Desktop

```tsx
<Globe
  className="lg:inset-0"
  offsetX={1 / 6}
  offsetY={0}
  ...
/>
```

The canvas is a plain full-bleed fill of the card (`inset-0`), and the card
itself is a fixed `h-[700px]` (vs. the mobile card's `aspect-[361/674]`).
`offsetX={1/6}` shifts the sphere right, off-center, to leave room for the
heading block (bottom-left) and the locations panel (bottom-right), which
are absolutely positioned on top of the canvas as separate sibling elements
in `App.tsx` — the globe itself has no awareness of them, it's just shifted
out of their way.

## Adding locations (CMS integration)

The location list is a hardcoded array at the top of `App.tsx`:

```ts
const locations: { label: string; location: [number, number] }[] = [
	{ label: 'San Francisco', location: [37.7749, -122.4194] },
	{ label: 'New York', location: [40.7128, -74.006] }
	// ...
];
```

This one array is the single source of truth — both the pins on the globe
and the location list panel(s) are derived from it further down in
`App.tsx`. To wire it up to a CMS, replace the hardcoded array with
CMS-fetched data of the same `{ label: string; location: [number, number] }[]`
shape (e.g. via `useState` + `useEffect`); nothing else needs to change.

Two things worth flagging to whoever wires this up:

- **`location` is `[latitude, longitude]`** — the reverse of GeoJSON's
  `[lng, lat]` convention. Easy to get backwards when piping in CMS or
  geocoding data.
- **Location selection is matched by exact coordinate equality.** If the CMS
  serves the same location with slightly different floating-point precision
  between requests, the selected marker can silently stop matching and
  deselect. Keep coordinate values stable/normalized coming out of the CMS
  layer.

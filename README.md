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

The location list is a hardcoded array in `src/lib/locations.ts`, typed as
`LocationDetail[]`:

```ts
export interface LocationDetail {
	label: string; // city — e.g. "Berlin"
	location: [number, number]; // [latitude, longitude]
	country: string; // e.g. "Germany"
	countryFlag: string; // image URL — same placeholder for every location today, see below
	company: string; // local entity name — e.g. "NGEN GmbH"
	establishedYear: number;
	kwhUnderManagement: string; // pre-formatted, e.g. "2.0 GWh"
	hasDataCenter: boolean;
	websiteUrl: string;
}
```

This one array is the single source of truth — the pins on the globe, the
location list panel(s), **and** the location info card/tooltip (click a
location to see it: flag, city/country, company, established year, kWh
under management, the "has data center" tag, and the "Visit website" link
— see `src/components/LocationInfoCard.tsx`) are all derived from it. To
wire it up to a CMS, replace the hardcoded array with CMS-fetched data of
the same `LocationDetail[]` shape (e.g. via `useState` + `useEffect`);
nothing else needs to change — every field is plain CMS-editable content,
none of it is derived or computed.

Things worth flagging to whoever wires this up:

- **`location` is `[latitude, longitude]`** — the reverse of GeoJSON's
  `[lng, lat]` convention. Easy to get backwards when piping in CMS or
  geocoding data.
- **Location selection is matched by exact coordinate equality.** If the CMS
  serves the same location with slightly different floating-point precision
  between requests, the selected marker can silently stop matching and
  deselect. Keep coordinate values stable/normalized coming out of the CMS
  layer.
- **`countryFlag` is an image URL, rendered via `<img>`**, but every
  location currently points at the same placeholder asset
  (`PLACEHOLDER_FLAG` in `lib/locations.ts`, imported from
  `src/assets/flag-placeholder.svg`) since the client hasn't supplied real
  per-country flags yet. Once the CMS serves those, each location's own
  `countryFlag` should be its real flag URL — no rendering code changes
  needed, `PLACEHOLDER_FLAG` and its import can just be deleted.
- **`kwhUnderManagement` is a pre-formatted string, not a number** — the CMS
  (or whatever feeds it) controls the unit and rounding (e.g. "0.9 GWh" vs
  "900 MWh"), the component just displays it as-is.

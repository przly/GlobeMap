import { useMemo, useState } from 'react';

export interface Pin {
	label: string;
	location: [number, number];
}

export type PinSource = 'existing' | 'custom' | 'none';

interface CustomPinRow {
	id: string;
	name: string;
	lat: string;
	lon: string;
}

let nextRowId = 0;
const makeEmptyRow = (): CustomPinRow => ({ id: String(nextRowId++), name: '', lat: '', lon: '' });

// Rows with an empty name or non-numeric coordinates are silently left out
// of the marker list rather than erroring, so a still-being-typed row just
// doesn't show a pin yet instead of breaking the rest of the list.
function parseCustomPins(rows: CustomPinRow[]): { label: string; location: [number, number] }[] {
	return rows.flatMap((row) => {
		const name = row.name.trim();
		const lat = Number(row.lat);
		const lon = Number(row.lon);
		if (!name || row.lat.trim() === '' || row.lon.trim() === '') return [];
		if (Number.isNaN(lat) || Number.isNaN(lon)) return [];
		return [{ label: name, location: [lat, lon] as [number, number] }];
	});
}

// Owns the panel's state (existing-vs-custom toggle plus the custom rows)
// in the page rather than in <PinsPanel>, so a page can unmount the panel
// (e.g. /preview's hide shortcut) without losing what was typed into it.
export function usePinsEditor(existingPins: Pin[]) {
	const [pinSource, setPinSource] = useState<PinSource>('existing');
	const [rows, setRows] = useState<CustomPinRow[]>(() => [makeEmptyRow()]);
	const customPins = useMemo(() => parseCustomPins(rows), [rows]);

	return {
		pinSource,
		setPinSource,
		rows,
		addRow: () => setRows((current) => [...current, makeEmptyRow()]),
		removeRow: (id: string) => setRows((current) => current.filter((row) => row.id !== id)),
		updateRow: (id: string, field: 'name' | 'lat' | 'lon', value: string) =>
			setRows((current) =>
				current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
			),
		customPins,
		pins: pinSource === 'existing' ? existingPins : pinSource === 'custom' ? customPins : []
	};
}

export type PinsEditor = ReturnType<typeof usePinsEditor>;

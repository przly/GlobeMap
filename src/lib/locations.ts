export interface LocationDetail {
	label: string;
	location: [number, number];
	country: string;
	countryFlag: string;
	company: string;
	establishedYear: number;
	kwhUnderManagement: string;
	hasDataCenter: boolean;
	websiteUrl: string;
}

// Placeholder data — every field beyond label/location is a stand-in until
// locations are wired up to a CMS (see README).
export const locations: LocationDetail[] = [
	{
		label: 'San Francisco',
		location: [37.7749, -122.4194],
		country: 'United States',
		countryFlag: '🇺🇸',
		company: 'NGEN Inc.',
		establishedYear: 2021,
		kwhUnderManagement: '0.9 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'New York',
		location: [40.7128, -74.006],
		country: 'United States',
		countryFlag: '🇺🇸',
		company: 'NGEN Inc.',
		establishedYear: 2022,
		kwhUnderManagement: '1.1 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'London',
		location: [51.5074, -0.1278],
		country: 'United Kingdom',
		countryFlag: '🇬🇧',
		company: 'NGEN UK Ltd.',
		establishedYear: 2020,
		kwhUnderManagement: '1.3 GWh',
		hasDataCenter: true,
		websiteUrl: '#'
	},
	{
		label: 'Berlin',
		location: [52.52, 13.405],
		country: 'Germany',
		countryFlag: '🇩🇪',
		company: 'NGEN GmbH',
		establishedYear: 2019,
		kwhUnderManagement: '2.0 GWh',
		hasDataCenter: true,
		websiteUrl: '#'
	},
	{
		label: 'Tokyo',
		location: [35.6762, 139.6503],
		country: 'Japan',
		countryFlag: '🇯🇵',
		company: 'NGEN K.K.',
		establishedYear: 2023,
		kwhUnderManagement: '0.7 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'Singapore',
		location: [1.3521, 103.8198],
		country: 'Singapore',
		countryFlag: '🇸🇬',
		company: 'NGEN Pte. Ltd.',
		establishedYear: 2022,
		kwhUnderManagement: '0.8 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'Sydney',
		location: [-33.8688, 151.2093],
		country: 'Australia',
		countryFlag: '🇦🇺',
		company: 'NGEN Pty Ltd',
		establishedYear: 2021,
		kwhUnderManagement: '0.6 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'Paris',
		location: [48.8566, 2.3522],
		country: 'France',
		countryFlag: '🇫🇷',
		company: 'NGEN SAS',
		establishedYear: 2020,
		kwhUnderManagement: '1.4 GWh',
		hasDataCenter: true,
		websiteUrl: '#'
	},
	{
		label: 'Madrid',
		location: [40.4168, -3.7038],
		country: 'Spain',
		countryFlag: '🇪🇸',
		company: 'NGEN S.L.',
		establishedYear: 2021,
		kwhUnderManagement: '1.0 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'Rome',
		location: [41.9028, 12.4964],
		country: 'Italy',
		countryFlag: '🇮🇹',
		company: 'NGEN S.r.l.',
		establishedYear: 2022,
		kwhUnderManagement: '0.9 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	},
	{
		label: 'Amsterdam',
		location: [52.3676, 4.9041],
		country: 'Netherlands',
		countryFlag: '🇳🇱',
		company: 'NGEN B.V.',
		establishedYear: 2019,
		kwhUnderManagement: '1.7 GWh',
		hasDataCenter: true,
		websiteUrl: '#'
	},
	{
		label: 'Vienna',
		location: [48.2082, 16.3738],
		country: 'Austria',
		countryFlag: '🇦🇹',
		company: 'NGEN GmbH',
		establishedYear: 2020,
		kwhUnderManagement: '1.2 GWh',
		hasDataCenter: false,
		websiteUrl: '#'
	}
];

export function isFocused(focusOn: [number, number] | null, location: [number, number]) {
	return focusOn !== null && focusOn[0] === location[0] && focusOn[1] === location[1];
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ExportPage from './ExportPage';
import PreviewPage from './PreviewPage';
import './index.css';

// No router in this project yet — a couple of extra paths don't warrant
// pulling one in, so it's just a plain pathname lookup.
const pages: Record<string, () => React.JSX.Element> = {
	'/export': ExportPage,
	'/preview': PreviewPage
};
const Page = pages[window.location.pathname] ?? App;

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Page />
	</StrictMode>
);

import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import type { LocationDetail } from '../lib/locations';

interface Props {
	location: LocationDetail;
	/**
	 * Mobile-only: renders a "Back" control at the top of the card and calls
	 * this when pressed, instead of relying on a pin/background click to
	 * deselect (the mobile card isn't anchored to a pin — see App.tsx).
	 */
	onBack?: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex w-full flex-col gap-[16px]">
			<div className="h-px w-full shrink-0 bg-[#e6eaed]" />
			<div className="flex w-full flex-col gap-[8px]">
				<p className="font-mono text-[10px] leading-none font-medium tracking-[-0.2px] text-[#7c868e] uppercase">
					{label}
				</p>
				<p className="font-['Inter'] text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-[#041c2c]">
					{value}
				</p>
			</div>
		</div>
	);
}

export default function LocationInfoCard({ location, onBack }: Props) {
	// onBack only exists for the mobile card (see App.tsx) — reused here as
	// the signal to drop the blur-in/out, shadow, and shell chrome (rounded
	// corners, border, background), all of which read as redundant on
	// mobile: the card already has its own slide transition, and renders
	// "bare" content-only inside a single persistent shell shared with the
	// locations list (so only the content swaps in place, not two separate
	// cards both sliding) rather than floating over the globe with its own
	// full card look.
	const isMobile = Boolean(onBack);

	return (
		<motion.div
			initial={{ opacity: 0, filter: isMobile ? 'none' : 'blur(16px)' }}
			animate={{ opacity: 1, filter: 'none' }}
			exit={{ opacity: 0, filter: isMobile ? 'none' : 'blur(16px)' }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			// The pin and card share one click-to-toggle handler up on
			// GlobeMarkerItem's wrapper (so clicking the pin opens/closes the
			// tooltip). Stopping propagation here means a click anywhere on the
			// card itself — other than the "Visit website" link, which already
			// stops its own propagation — never reaches that handler, so it does
			// nothing instead of closing the tooltip. Only the pin or a genuine
			// outside click (the globe background) closes it.
			onClick={(event) => event.stopPropagation()}
			// Width is entirely up to the caller (w-full) rather than a fixed
			// 361px here — desktop wraps this in a 361px-wide container (see
			// App.tsx), while on mobile it needs to match the locations list's
			// width exactly, which is responsive (fills the page's padded
			// width), not a fixed pixel value.
			className={cn(
				'flex w-full cursor-default flex-col p-[24px]',
				isMobile ? 'h-full justify-between' : 'gap-[32px]',
				isMobile ? '' : 'rounded-[36px] border border-[#e6eaed] bg-white shadow-xl'
			)}
		>
			{onBack ? (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onBack();
					}}
					className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-[6px] self-start rounded-[9000px] border border-[#42515d] bg-[#041c2c] px-[14px] py-[10px] text-[12px] font-normal text-white transition-colors duration-200 ease-out hover:bg-[#0a2841]"
				>
					<svg width="4" height="6" viewBox="0 0 4 6" fill="none" aria-hidden="true" className="shrink-0">
						<path
							d="M1.08828 2.8252L3.13828 4.8752C3.22995 4.96686 3.27578 5.0752 3.27578 5.2002C3.27578 5.31686 3.22995 5.42103 3.13828 5.5127C3.04661 5.60436 2.93828 5.6502 2.81328 5.6502C2.69661 5.6502 2.59245 5.60436 2.50078 5.5127L0.125781 3.1377C0.0841149 3.09603 0.0507816 3.0502 0.0257815 3.0002C0.00911486 2.94186 0.000781536 2.88353 0.000781536 2.8252C0.000781536 2.76686 0.00911486 2.7127 0.0257815 2.66269C0.0507816 2.60436 0.0841149 2.55436 0.125781 2.5127L2.50078 0.137695C2.59245 0.0460281 2.69661 0.000194788 2.81328 0.000194788C2.93828 0.000194788 3.04661 0.0460281 3.13828 0.137695C3.22995 0.229362 3.27578 0.337695 3.27578 0.462695C3.27578 0.579362 3.22995 0.683528 3.13828 0.775195L1.08828 2.8252Z"
							fill="white"
						/>
					</svg>
					Back
				</button>
			) : null}

			{/* Grouped together (rather than direct children of the root) so
			    mobile's justify-between above has exactly two items — the back
			    button pinned to the top, this whole group pinned to the bottom —
			    with all the extra space (from matching the list's height)
			    landing between them instead of getting distributed among every
			    section. Desktop's own gap-[32px] on the root produces the exact
			    same spacing as before, since this is its only child either way. */}
			<div className="flex w-full flex-col gap-[32px]">
				<div className="flex w-full items-center justify-between">
					{/* Every location currently shares the same placeholder image
					    (see PLACEHOLDER_FLAG in lib/locations.ts) until the CMS
					    supplies real per-country flags. The 24x24 box is just a
					    consistent layout slot — the flag itself keeps its natural
					    22:16 aspect ratio inside it, centered, rather than being
					    stretched/cropped square. */}
					<span className="flex size-[24px] shrink-0 items-center justify-center" aria-hidden="true">
						<img
							src={location.countryFlag}
							alt=""
							className="h-[16px] w-[22px] rounded-[4px] border-[0.5px] border-black/10 object-cover"
						/>
					</span>
					{location.hasDataCenter ? (
						<span className="inline-flex shrink-0 items-center gap-[6px] rounded-[6060px] border border-[#82e472] bg-[#44d62c] py-[8px] pr-[12px] pl-[8px] text-[12px] leading-none text-[#041c2c] uppercase">
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								aria-hidden="true"
								className="shrink-0"
							>
								<path
									d="M5.36172 6.5252L4.61172 5.78769C4.52005 5.69603 4.41589 5.6502 4.29922 5.6502C4.18255 5.6502 4.07839 5.69603 3.98672 5.78769C3.89505 5.87936 3.84922 5.9877 3.84922 6.1127C3.84922 6.22936 3.89505 6.33353 3.98672 6.4252L5.04922 7.4877C5.14089 7.57936 5.24505 7.6252 5.36172 7.6252C5.47839 7.6252 5.58255 7.57936 5.67422 7.4877L8.01172 5.1502C8.10339 5.05853 8.14922 4.95436 8.14922 4.8377C8.14922 4.7127 8.10339 4.60436 8.01172 4.5127C7.92005 4.42103 7.81589 4.3752 7.69922 4.3752C7.58255 4.3752 7.47839 4.42103 7.38672 4.5127L5.36172 6.5252ZM5.99922 10.8002C5.34089 10.8002 4.72005 10.6752 4.13672 10.4252C3.55339 10.1752 3.04089 9.83353 2.59922 9.4002C2.16589 8.95853 1.82422 8.44603 1.57422 7.8627C1.32422 7.27936 1.19922 6.65853 1.19922 6.0002C1.19922 5.33353 1.32422 4.7127 1.57422 4.1377C1.82422 3.55436 2.16589 3.04603 2.59922 2.6127C3.04089 2.17103 3.55339 1.8252 4.13672 1.5752C4.72005 1.3252 5.34089 1.2002 5.99922 1.2002C6.66589 1.2002 7.28672 1.3252 7.86172 1.5752C8.44505 1.8252 8.95339 2.17103 9.38672 2.6127C9.82839 3.04603 10.1742 3.55436 10.4242 4.1377C10.6742 4.7127 10.7992 5.33353 10.7992 6.0002C10.7992 6.65853 10.6742 7.27936 10.4242 7.8627C10.1742 8.44603 9.82839 8.95853 9.38672 9.4002C8.95339 9.83353 8.44505 10.1752 7.86172 10.4252C7.28672 10.6752 6.66589 10.8002 5.99922 10.8002ZM5.99922 9.9002C7.08255 9.9002 8.00339 9.52103 8.76172 8.7627C9.52005 8.00436 9.89922 7.08353 9.89922 6.0002C9.89922 4.91686 9.52005 3.99603 8.76172 3.23769C8.00339 2.47936 7.08255 2.1002 5.99922 2.1002C4.91589 2.1002 3.99505 2.47936 3.23672 3.23769C2.47839 3.99603 2.09922 4.91686 2.09922 6.0002C2.09922 7.08353 2.47839 8.00436 3.23672 8.7627C3.99505 9.52103 4.91589 9.9002 5.99922 9.9002Z"
									fill="#041C2C"
								/>
							</svg>
							<span className="font-mono font-medium tracking-[-0.24px]">has data center</span>
						</span>
					) : null}
				</div>

				<div className="flex flex-col gap-[2px]">
					<p className="font-['Inter'] text-[20px] leading-[1.2] font-medium tracking-[-0.4px] text-[#041c2c]">
						{location.label}, {location.country}
					</p>
					<p className="font-['Inter'] text-[14px] leading-[1.5] font-normal text-[#7c868e]">
						{location.company}
					</p>
				</div>

				<div className="flex w-full flex-col gap-[24px]">
					<Stat label="established" value={String(location.establishedYear)} />
					<Stat label="kWh under management" value={location.kwhUnderManagement} />
				</div>

				<a
					href={location.websiteUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex shrink-0 items-center gap-[6px] self-end rounded-[9000px] border border-[#82e472] bg-[#44d62c] px-[14px] py-[10px] text-[12px] font-normal text-[#041c2c] transition-colors duration-200 ease-out hover:bg-[#3bc224]"
				>
					Visit website
					<svg width="8" height="7" viewBox="0 0 8 7" fill="none" aria-hidden="true" className="shrink-0">
						<path
							d="M5.47461 3.8748H0.44961C0.32461 3.8748 0.216276 3.83314 0.124609 3.7498C0.0412762 3.65814 -0.00039041 3.5498 -0.00039041 3.4248C-0.00039041 3.2998 0.0412762 3.19564 0.124609 3.1123C0.216276 3.02064 0.32461 2.9748 0.44961 2.9748H5.47461L3.27461 0.774804C3.18294 0.683138 3.13711 0.578971 3.13711 0.462304C3.13711 0.337304 3.18294 0.228971 3.27461 0.137304C3.36628 0.0456374 3.47044 -0.00019598 3.58711 -0.00019598C3.71211 -0.00019598 3.82044 0.0456374 3.91211 0.137304L6.88711 3.1123C6.92878 3.15397 6.95794 3.20397 6.97461 3.2623C6.99961 3.3123 7.01211 3.36647 7.01211 3.4248C7.01211 3.48314 6.99961 3.54147 6.97461 3.5998C6.95794 3.6498 6.92878 3.69564 6.88711 3.7373L3.91211 6.7123C3.82044 6.80397 3.71628 6.8498 3.59961 6.8498C3.48294 6.84147 3.37878 6.79147 3.28711 6.6998C3.19544 6.60814 3.14961 6.50397 3.14961 6.3873C3.14961 6.2623 3.19544 6.15397 3.28711 6.0623L5.47461 3.8748Z"
							fill="#041C2C"
						/>
					</svg>
				</a>
			</div>
		</motion.div>
	);
}

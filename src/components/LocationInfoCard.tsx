import { motion } from 'motion/react';
import type { LocationDetail } from '../lib/locations';

interface Props {
	location: LocationDetail;
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

export default function LocationInfoCard({ location }: Props) {
	return (
		<motion.div
			initial={{ opacity: 0, filter: 'blur(16px)' }}
			animate={{ opacity: 1, filter: 'blur(0px)' }}
			exit={{ opacity: 0, filter: 'blur(16px)' }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			// The pin and card share one click-to-toggle handler up on
			// GlobeMarkerItem's wrapper (so clicking the pin opens/closes the
			// tooltip). Stopping propagation here means a click anywhere on the
			// card itself — other than the "Visit website" link, which already
			// stops its own propagation — never reaches that handler, so it does
			// nothing instead of closing the tooltip. Only the pin or a genuine
			// outside click (the globe background) closes it.
			onClick={(event) => event.stopPropagation()}
			className="flex w-[min(361px,calc(100vw-2rem))] flex-col gap-[32px] rounded-[36px] border border-[#e6eaed] bg-white p-[24px] shadow-xl"
		>
			<div className="flex w-full items-center justify-between">
				<span
					className="flex size-[24px] shrink-0 items-center justify-center rounded-[4px] border-[0.5px] border-black/10 text-[14px] leading-none"
					aria-hidden="true"
				>
					{location.countryFlag}
				</span>
				{location.hasDataCenter ? (
					<span className="inline-flex shrink-0 items-center gap-[6px] rounded-[6060px] border border-[#82e472] bg-[#44d62c] py-[8px] pr-[12px] pl-[8px] text-[12px] text-[#041c2c] uppercase">
						<span aria-hidden="true" className="text-[12px] leading-none">
							✓
						</span>
						<span className="font-mono font-semibold tracking-[-0.24px]">has data center</span>
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
				<span aria-hidden="true" className="text-[12px] leading-none">
					→
				</span>
			</a>
		</motion.div>
	);
}

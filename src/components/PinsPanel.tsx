import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { BUTTON_STYLE, FIELD_STYLE, LABEL_STYLE } from '../lib/controlStyles';
import type { PinSource, PinsEditor } from '../lib/pinsEditor';

// "None" clears every pin off the globe without losing anything typed
// into the Custom rows.
const PIN_SOURCE_OPTIONS: { value: PinSource; label: string }[] = [
	{ value: 'existing', label: 'Existing' },
	{ value: 'custom', label: 'Custom' },
	{ value: 'none', label: 'None' }
];

export function PinsPanel({
	editor,
	className,
	footer
}: {
	editor: PinsEditor;
	className?: string;
	footer?: ReactNode;
}) {
	return (
		<div
			className={cn(
				'flex w-[320px] flex-col gap-3 rounded-[24px] border-[0.5px] border-[#e6eaed] bg-white/90 px-[18px] py-[14px] shadow-lg backdrop-blur-sm',
				className
			)}
		>
			<span className={cn(LABEL_STYLE, 'text-sm font-semibold text-gray-900')}>Pins</span>

			<div className="flex gap-1 rounded-full bg-[#f4f6f7] p-[3px]">
				{PIN_SOURCE_OPTIONS.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						onClick={() => editor.setPinSource(value)}
						className={cn(
							"flex-1 rounded-full px-3 py-1 font-['Inter'] text-xs font-medium whitespace-nowrap transition-all duration-80 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:scale-98",
							editor.pinSource === value
								? 'bg-white text-[#041c2c] shadow-sm'
								: 'text-[#7c868e] hover:text-[#041c2c]'
						)}
					>
						{label}
					</button>
				))}
			</div>

			{editor.pinSource === 'custom' ? (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1.5 px-0.5">
						<span className={cn(LABEL_STYLE, 'flex-1')}>Name</span>
						<span className={cn(LABEL_STYLE, 'w-[54px] shrink-0')}>Lat</span>
						<span className={cn(LABEL_STYLE, 'w-[54px] shrink-0')}>Lon</span>
						<span className="w-[30px] shrink-0" />
					</div>

					{editor.rows.map((row) => (
						<div key={row.id} className="flex items-center gap-1.5">
							<input
								type="text"
								value={row.name}
								onChange={(event) => editor.updateRow(row.id, 'name', event.target.value)}
								placeholder="Berlin"
								className={cn(FIELD_STYLE, 'w-0 flex-1 px-1.5 py-1 text-[11px]')}
								aria-label="Pin name"
							/>
							<input
								type="text"
								inputMode="decimal"
								value={row.lat}
								onChange={(event) => editor.updateRow(row.id, 'lat', event.target.value)}
								placeholder="52.52"
								className={cn(FIELD_STYLE, 'w-[54px] shrink-0 px-1.5 py-1 text-[11px]')}
								aria-label="Pin latitude"
							/>
							<input
								type="text"
								inputMode="decimal"
								value={row.lon}
								onChange={(event) => editor.updateRow(row.id, 'lon', event.target.value)}
								placeholder="13.4"
								className={cn(FIELD_STYLE, 'w-[54px] shrink-0 px-1.5 py-1 text-[11px]')}
								aria-label="Pin longitude"
							/>
							<button
								type="button"
								onClick={() => editor.removeRow(row.id)}
								disabled={editor.rows.length === 1}
								className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[32px] text-gray-400 transition-all duration-80 outline-none hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:scale-98 disabled:pointer-events-none disabled:opacity-0"
								aria-label="Remove pin"
								title="Remove pin"
							>
								<X size={14} strokeWidth={2.5} aria-hidden="true" />
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={editor.addRow}
						className={cn(
							BUTTON_STYLE,
							"my-2 min-h-7.5 gap-1.5 self-center px-3.5 font-['Inter'] text-xs"
						)}
					>
						<Plus size={14} strokeWidth={2.5} aria-hidden="true" />
						Add pin
					</button>

					<span className={cn(LABEL_STYLE, 'text-center')}>
						{editor.pins.length} pin{editor.pins.length === 1 ? '' : 's'} on the globe
					</span>
				</div>
			) : null}

			{footer}
		</div>
	);
}

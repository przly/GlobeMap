// Form-control styles shared by the /export and /preview tool panels.

// Ported from the Specto marketing site's Input component
// (src/components/atoms/Input/Input.tsx) — same border/radius/text colors,
// same focus ring (a 3px rgba(4,28,44,0.10) ring + border-gray-400, where
// 4,28,44 is this project's own #041c2c navy), same gray-* color tokens
// (added to index.css) and font-primary (Inter). rounded-[8px] is hardcoded
// rather than Tailwind's `rounded-lg` because this project's own --radius-lg
// token is redefined much larger than the Specto site's (unoverridden,
// default 8px) — the arbitrary value keeps the actual rendered radius the
// same as that repo's, not this one's.
export const FIELD_STYLE =
	"rounded-[8px] border-[0.5px] border-gray-200 bg-white font-['Inter'] font-medium text-gray-900 placeholder:text-gray-500 transition-shadow duration-100 focus:border-gray-400 focus:ring-[3px] focus:ring-[rgba(4,28,44,0.10)] focus:outline-none";

// Ported from the same repo's FormField.Label ('light' variant): Inter
// (--font-primary), text-xs, text-gray-500 — no mono/uppercase/tracking,
// unlike this panel's earlier ad-hoc label style.
export const LABEL_STYLE = "font-['Inter'] text-xs leading-none text-gray-500";

// Ported from the Specto marketing site's Button component
// (src/components/atoms/Button/Button.tsx) — same pill radius, motion,
// and focus-visible ring (--color-focus, added to index.css), using its
// flat "gray" variant (no border-gradient) at its smallest ("xs") size.
// rounded-[32px] is hardcoded for the same reason FIELD_STYLE hardcodes its
// radius: this project's own --radius-* scale is redefined, so Tailwind's
// `rounded-4xl` here wouldn't render at the same size as it does there.
export const BUTTON_STYLE =
	'inline-flex cursor-pointer items-center justify-center rounded-[32px] border border-gray-50 bg-gray-50 text-gray-900 transition-all duration-80 outline-none hover:border-gray-100 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] active:scale-98 disabled:pointer-events-none disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400';

/**
 * Spinner — animated loading indicator.
 *
 * Wraps the Lucide `Loader2Icon` with a spin animation and sensible
 * accessibility defaults (`role="status"`, `aria-label`). Accepts all
 * standard SVG props so consumers can resize or recolour it via
 * Tailwind classes.
 *
 * @module components/ui/spinner
 */

import { cn } from '@ui/lib/utils';
import { Loader2Icon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Animated spinner for loading states.
 *
 * Defaults to `size-4` — pass a `className` with a different `size-*`
 * utility to override.
 */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return <Loader2Icon role="status" aria-label="Loading" className={cn('size-4 animate-spin', className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { Spinner };

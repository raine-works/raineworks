/**
 * Hook to detect mobile viewport widths.
 *
 * Uses `window.matchMedia` to track whether the viewport is below
 * the mobile breakpoint (768px by default). Updates reactively on
 * window resize.
 *
 * @module hooks/use-mobile
 */

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when the viewport width is below the mobile
 * breakpoint (768px). Updates in real-time as the window resizes.
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * return isMobile ? <MobileNav /> : <DesktopNav />;
 * ```
 */
export function useIsMobile() {
	const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

		const onChange = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};

		mql.addEventListener('change', onChange);

		// Set the initial value.
		setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

		return () => mql.removeEventListener('change', onChange);
	}, []);

	return !!isMobile;
}

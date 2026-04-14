/**
 * Head provider — portal-based `<head>` management and reactive favicon.
 *
 * Provides three primitives for managing the document `<head>` from within
 * the React tree:
 *
 * - **`Head`** — a portal that renders children directly into `document.head`,
 *   allowing any component to declaratively inject `<title>`, `<meta>`, or
 *   `<link>` elements.
 *
 * - **`HeadContent`** — pre-built head content (title, description, Open Graph,
 *   Twitter Card, and favicon links) driven by simple props. Favicon path and
 *   MIME type are configurable — the type is auto-detected from the file
 *   extension when not provided explicitly.
 *
 * - **`FaviconProvider`** — swaps the favicon between an active and inactive
 *   variant based on the tab's `visibilitychange` event, giving users a
 *   visual cue when they return to a backgrounded tab. Both paths are
 *   configurable via props.
 *
 * @module providers/head
 */

import { createContext, type PropsWithChildren, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FAVICON = '/favicon.svg';
const DEFAULT_INACTIVE_FAVICON = '/favicon-inactive.svg';
const REACTIVE_FAVICON_ID = 'reactive-favicon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeadContentProps {
	title?: string;
	description?: string;
	image?: string;
	url?: string;
	/** Path to the favicon file. Defaults to `"/favicon.svg"`. */
	favicon?: string;
	/**
	 * MIME type for the favicon `<link>`. When omitted, auto-detected from
	 * the file extension of `favicon` (e.g. `.png` → `"image/png"`,
	 * `.svg` → `"image/svg+xml"`, `.ico` → `"image/x-icon"`).
	 */
	faviconType?: string;
}

interface FaviconProviderProps extends PropsWithChildren {
	/** Favicon shown when the tab is active (foreground). Defaults to `"/favicon.svg"`. */
	favicon?: string;
	/** Favicon shown when the tab is backgrounded. Defaults to `"/favicon-inactive.svg"`. */
	inactiveFavicon?: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FaviconContext = createContext({});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the MIME type from a favicon file path based on its extension.
 *
 * Supports the most common favicon formats: SVG, PNG, ICO, GIF, and JPEG.
 * Falls back to `"image/x-icon"` for unrecognised extensions.
 */
function detectFaviconType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();

	switch (ext) {
		case 'svg':
			return 'image/svg+xml';
		case 'png':
			return 'image/png';
		case 'ico':
			return 'image/x-icon';
		case 'gif':
			return 'image/gif';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'webp':
			return 'image/webp';
		default:
			return 'image/x-icon';
	}
}

// ---------------------------------------------------------------------------
// Head portal
// ---------------------------------------------------------------------------

/**
 * Renders children into `document.head` via a React portal.
 *
 * Use this to declaratively inject arbitrary `<meta>`, `<link>`, or `<title>`
 * elements from anywhere in the component tree.
 */
function Head({ children }: PropsWithChildren) {
	return createPortal(children, document.head);
}

// ---------------------------------------------------------------------------
// HeadContent
// ---------------------------------------------------------------------------

/**
 * Injects a standard set of head elements — page title, meta description,
 * Open Graph tags, Twitter Card tags, and favicon links.
 *
 * Props are optional and fall back to sensible RaineStack defaults. The favicon
 * path is configurable and the MIME type is auto-detected from the file
 * extension unless overridden via `faviconType`.
 */
function HeadContent({
	title = 'RaineStack',
	description = '',
	image = '',
	url = '',
	favicon = DEFAULT_FAVICON,
	faviconType
}: HeadContentProps) {
	const resolvedType = faviconType ?? detectFaviconType(favicon);

	return (
		<Head>
			<title>{title}</title>
			<meta charSet="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />

			{/* Open Graph */}
			<meta property="og:title" content={title} />
			<meta property="og:url" content={url} />
			<meta property="og:image" content={image} />
			<meta property="og:description" content={description} />
			<meta property="og:type" content="website" />

			{/* Twitter Card */}
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:title" content={title} />
			<meta name="twitter:description" content={description} />
			<meta name="twitter:image" content={image} />

			{/* Description */}
			<meta name="description" content={description} />

			{/* Favicons */}
			<link rel="icon" type={resolvedType} href={favicon} sizes="any" />
			<link id={REACTIVE_FAVICON_ID} rel="icon" type={resolvedType} href={favicon} sizes="any" />
		</Head>
	);
}

// ---------------------------------------------------------------------------
// FaviconProvider
// ---------------------------------------------------------------------------

/**
 * Swaps the reactive favicon between active and inactive variants based on
 * tab visibility. When the user backgrounds the tab the favicon switches to
 * the inactive variant; foregrounding restores the active variant.
 *
 * Both favicon paths are configurable via props — pass the same paths used
 * in `<HeadContent>` to keep them in sync.
 *
 * Wrap this around your application (or a subtree) to opt in to the
 * behaviour — it renders children unchanged.
 */
function FaviconProvider({
	children,
	favicon = DEFAULT_FAVICON,
	inactiveFavicon = DEFAULT_INACTIVE_FAVICON
}: FaviconProviderProps) {
	useEffect(() => {
		function updateFavicon() {
			const el = document.getElementById(REACTIVE_FAVICON_ID);
			const href = document.hidden ? inactiveFavicon : favicon;
			el?.setAttribute('href', href);
		}

		document.addEventListener('visibilitychange', updateFavicon);
		return () => document.removeEventListener('visibilitychange', updateFavicon);
	}, [favicon, inactiveFavicon]);

	return <FaviconContext.Provider value={{}}>{children}</FaviconContext.Provider>;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { FaviconProvider, Head, HeadContent };
export type { FaviconProviderProps, HeadContentProps };

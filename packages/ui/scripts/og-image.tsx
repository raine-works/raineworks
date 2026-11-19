/**
 * Draws the site's share image (`src/assets/og-image.png`, 1200×630, `SHARE_IMAGE` in `lib/head`): the logo, drawn
 * from `blocks/brand`, Raine's name and the site's address in Geist, on the dark theme's colours. Rendered with a
 * headless Chrome; run it again when the logo or the words change.
 *
 * ```bash
 * bun run og-image [path/to/chrome]   # defaults to macOS's Google Chrome
 * ```
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AppLogo, AppMark } from '@raineworks/ui/blocks/brand';
import { SHARE_IMAGE } from '@raineworks/ui/lib/head';
import { renderToStaticMarkup } from 'react-dom/server';

const chrome = process.argv[2] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const font = (name: string) =>
	Bun.pathToFileURL(
		Bun.resolveSync(`@fontsource-variable/${name}/files/${name}-latin-wght-normal.woff2`, import.meta.dir),
	).href;
const output = join(import.meta.dir, '../src/assets', SHARE_IMAGE.file);

const page = renderToStaticMarkup(
	<html lang="en">
		<head>
			<style>{`
				@font-face { font-family: Geist; src: url(${font('geist')}) format('woff2'); font-weight: 100 900; }
				@font-face { font-family: Geist Mono; src: url(${font('geist-mono')}) format('woff2'); font-weight: 100 900; }
				* { margin: 0; box-sizing: border-box; }
				body { width: ${SHARE_IMAGE.width}px; height: ${SHARE_IMAGE.height}px; overflow: hidden; background: #0a0a0a; color: #fafafa; font-family: Geist; }
				.grid { position: absolute; inset: 0; background-image: linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg, #ffffff0d 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at 80% 40%, #000 20%, transparent 75%); }
				.mark { position: absolute; right: -40px; top: 50%; width: 520px; height: 520px; transform: translateY(-50%); color: #ffffff1f; }
				main { position: relative; display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 72px 80px; }
				.logo { height: 56px; width: auto; align-self: flex-start; }
				h1 { font-size: 88px; font-weight: 600; letter-spacing: -0.04em; line-height: 1; }
				p { margin-top: 20px; font-size: 36px; color: #a1a1a1; letter-spacing: -0.01em; }
				footer { font-family: Geist Mono; font-size: 26px; color: #a1a1a1; }
			`}</style>
		</head>
		<body>
			<div className="grid" />
			<AppMark className="mark" strokeWidth={1.6} />
			<main>
				<AppLogo className="logo" strokeWidth={3.6} />
				<div>
					<h1>Raine Petersen</h1>
					<p>Software, systems and open source.</p>
				</div>
				<footer>raineworks.com</footer>
			</main>
		</body>
	</html>,
);

const workDir = mkdtempSync(join(tmpdir(), 'raineworks-og-'));
try {
	const html = join(workDir, 'og.html');
	await Bun.write(html, `<!doctype html>${page}`);
	const run = Bun.spawnSync([
		chrome,
		'--headless=new',
		'--hide-scrollbars',
		'--force-device-scale-factor=1',
		`--window-size=${SHARE_IMAGE.width},${SHARE_IMAGE.height}`,
		'--virtual-time-budget=2000',
		`--screenshot=${output}`,
		Bun.pathToFileURL(html).href,
	]);
	if (run.exitCode !== 0) throw new Error(`Chrome failed: ${run.stderr.toString()}`);
	console.log(`✅ Wrote ${output}`);
} finally {
	rmSync(workDir, { recursive: true, force: true });
}

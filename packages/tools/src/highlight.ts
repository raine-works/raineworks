/**
 * Syntax colouring for code in the docs: highlight.js's core with only the
 * languages they show, used by the API reference's samples in the browser and
 * by Markdown's code blocks at build time (`@raineworks/tools/markdown`). Its output
 * escapes the code; colours are the `.hljs-*` classes in `styles.css`.
 *
 * @module highlight
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import http from 'highlight.js/lib/languages/http';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';

for (const [name, language] of Object.entries({ bash, go, http, javascript, json, php, python, ruby })) {
	hljs.registerLanguage(name, language);
}
hljs.registerAliases(['sh', 'shell', 'curl'], { languageName: 'bash' });
hljs.registerAliases(['js', 'ts', 'typescript', 'node'], { languageName: 'javascript' });

/** `code` as highlighted HTML (escaped); just escaped when `language` isn't one of these. */
export function highlight(code: string, language: string | undefined): string {
	if (language && hljs.getLanguage(language)) return hljs.highlight(code, { language }).value;
	return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

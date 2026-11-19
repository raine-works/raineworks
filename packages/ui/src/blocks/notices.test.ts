import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { grouped, namedGroups, paragraphs } from '@raineworks/ui/blocks/notices';

describe('a licence’s text as paragraphs', () => {
	test('the OFL: rules dropped, headings and each copyright on their own, wrapped lines joined', async () => {
		const ofl = await Bun.file(join(import.meta.dir, '../../node_modules/@fontsource-variable/geist/LICENSE')).text();
		const parts = paragraphs(ofl);
		const texts = parts.map(({ text }) => text);
		expect(texts[0]).toBe('Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)');
		expect(texts[1]).toStartWith('Geist-Italic[wght].ttf: Copyright 2024');
		expect(texts).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
		expect(texts.some((text) => text.includes('-----'))).toBe(false);
		expect(parts.filter(({ heading }) => heading).map(({ text }) => text)).toEqual(
			expect.arrayContaining(['PREAMBLE', 'DEFINITIONS', 'PERMISSION & CONDITIONS', 'TERMINATION', 'DISCLAIMER']),
		);
		const preamble = texts.indexOf('PREAMBLE');
		expect(texts[preamble + 1]).toStartWith(
			'The goals of the Open Font License (OFL) are to stimulate worldwide development',
		);
		// Only white space changes: every word is still there, in order.
		const words = (text: string) => text.replace(/-{3,}/g, ' ').split(/\s+/).filter(Boolean);
		expect(words(texts.join(' '))).toEqual(words(ofl));
	});

	test('MIT: its title, its copyright and each paragraph', () => {
		const mit =
			'MIT License\n\nCopyright (c) 2021 Someone\n\nPermission is hereby granted, free of charge,\nto any person.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED.';
		expect(paragraphs(mit).map(({ text }) => text)).toEqual([
			'MIT License',
			'Copyright (c) 2021 Someone',
			'Permission is hereby granted, free of charge, to any person.',
			'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.',
		]);
		// A sentence in capitals isn't a heading.
		expect(paragraphs(mit).every(({ heading }) => !heading)).toBe(true);
	});
});

describe('the groups’ names', () => {
	const notice = (name: string, text: string) => ({ name, version: '1.0.0', license: 'MIT', text });

	test('a scope under two licence texts is told apart by package, not named twice', () => {
		const groups = grouped([
			notice('@tanstack/history', 'Copyright (c) 2021-present'),
			notice('@tanstack/react-router', 'Copyright (c) 2021-present'),
			notice('@tanstack/store', 'Copyright (c) 2021'),
			notice('@tanstack/react-store', 'Copyright (c) 2021'),
			notice('clsx', 'Copyright (c) Luke'),
		]);
		expect(namedGroups(groups).map(({ name }) => name)).toEqual([
			'@tanstack/history and 1 other',
			'@tanstack/store and 1 other',
			'clsx',
		]);
	});

	test('a scope under one licence text keeps its short name', () => {
		const groups = grouped([notice('@radix-ui/a', 'x'), notice('@radix-ui/b', 'x')]);
		expect(namedGroups(groups).map(({ name }) => name)).toEqual(['@radix-ui']);
	});
});

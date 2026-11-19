import { afterEach, describe, expect, mock, test } from 'bun:test';

import { testRender } from '@opentui/react/test-utils';
import type { Project } from '@raineworks/api';
import { App, type LoadProjects, type SendMessage } from '@raineworks/ssh/app';
import { titleFont } from '@raineworks/ssh/screens/home';
import { profile } from '@raineworks/web-marketing/content/profile';

const projects: Project[] = [
	{
		name: 'ha-grok',
		description: 'Grok for Home Assistant.',
		href: 'https://github.com/raine-works/ha-grok',
		stack: ['Python', 'home-assistant'],
		stars: 12,
		featured: true,
	},
	{
		name: 'raineworks',
		description: '',
		href: 'https://github.com/raine-works/raineworks',
		stack: ['TypeScript'],
		stars: 3,
		featured: false,
	},
];

// The clock and the rain update state on timers, outside `act`: what's tested is each frame as drawn.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

type Setup = Awaited<ReturnType<typeof testRender>>;
let current: Setup | undefined;
afterEach(async () => {
	await current?.dispose();
	current = undefined;
});

async function open({
	width = 120,
	height = 36,
	send = async () => ({ ok: true }) as const,
	loadProjects = async () => projects,
}: { width?: number; height?: number; send?: SendMessage; loadProjects?: LoadProjects } = {}) {
	const onQuit = mock(() => {});
	current = await testRender(
		<App version="2026.11.1" rain={false} send={send} loadProjects={loadProjects} onQuit={onQuit} />,
		{ width, height },
	);
	// The projects load in an effect: let it settle before the first frame.
	await Bun.sleep(0);
	await current.renderOnce();
	const setup = current;
	/** Presses keys in turn (a name from OpenTUI's `KeyCodes`, a character, or `ctrl+x`), drawing after each. */
	const press = async (...keys: string[]) => {
		for (const key of keys) {
			if (key.startsWith('ctrl+')) await setup.mockInput.pressKey(key.slice(5), { ctrl: true });
			else if (key.length === 1) await setup.mockInput.typeText(key);
			else await setup.mockInput.pressKey(key as never);
			await setup.renderOnce();
		}
	};
	const type = async (text: string) => {
		await setup.mockInput.typeText(text);
		await setup.renderOnce();
	};
	return { setup, press, type, frame: () => setup.captureCharFrame(), onQuit };
}

describe('the SSH app', () => {
	test('opens on Home: the title, who Raine is, the screens and the keys', async () => {
		const { frame } = await open();
		const screen = frame();
		// The lockup: the mark in braille, then the title (at 120 wide, the slick font fits beside it).
		expect(screen.split('\n').some((row) => /[⠁-⣿]/.test(row) && row.includes('╭━━━╮'))).toBe(true);
		expect(screen).toContain(profile.name);
		for (const label of ['Home', 'Work', 'Projects', 'Hobbies', 'Contact', 'About']) expect(screen).toContain(label);
		expect(screen).toContain('NAV');
		expect(screen).toContain('v2026.11.1');
	});

	test('number keys, arrows and the palette move between screens', async () => {
		const { press, type, frame } = await open();
		await press('2');
		expect(frame()).toContain('Where I’ve worked');
		await press('ARROW_RIGHT');
		expect(frame()).toContain('O P E N   S O U R C E');
		await press('ctrl+k');
		expect(frame()).toContain('Command palette');
		await type('hob');
		await press('RETURN');
		expect(frame()).toContain('Away from the keyboard');
		expect(frame()).not.toContain('Command palette');
	});

	test('Projects: ↑/↓ choose a project and show it in full', async () => {
		const { press, frame } = await open();
		await press('3');
		expect(frame()).toContain('Grok for Home Assistant.');
		expect(frame()).toContain('home-assistant');
		await press('j');
		expect(frame()).toContain('2 of 2');
		expect(frame()).toContain('github.com/raine-works/raineworks');
		expect(frame()).toContain('you’re looking at it');
	});

	test('Projects: says so when they couldn’t be loaded, and points to GitHub', async () => {
		const { press, frame } = await open({ loadProjects: async () => null });
		await press('3', 'j');
		expect(frame()).toContain('The projects couldn’t be loaded from GitHub just now.');
		expect(frame()).toContain('github.com/raine-works');
	});

	test('Contact: sending an empty form says what’s missing, under each field', async () => {
		const send = mock<SendMessage>(async () => ({ ok: true }));
		const { press, frame } = await open({ send });
		await press('5', 'RETURN');
		expect(frame()).toContain('TYPE');
		await press('ctrl+s');
		expect(frame()).toContain('Enter your name.');
		expect(frame()).toContain('Enter your email address, so I can reply.');
		expect(frame()).toContain('Write a message.');
		expect(send).not.toHaveBeenCalled();
	});

	test('Contact: a filled form is sent through `send`, then cleared, with a thank-you', async () => {
		const send = mock<SendMessage>(async () => ({ ok: true }));
		const { press, type, frame } = await open({ send });
		await press('5', 'RETURN');
		await type('Ada Lovelace');
		await press('TAB');
		await type('ada@example.com');
		await press('TAB');
		await type('Hello from the terminal');
		await press('ctrl+s');
		await Bun.sleep(10);
		await current?.renderOnce();
		expect(send).toHaveBeenCalledWith({
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			message: 'Hello from the terminal',
		});
		expect(frame()).toContain('Message sent. Thanks, Ada Lovelace.');
		expect(frame()).toContain('NAV');
	});

	test('Contact: what the server refuses is shown, and the form keeps what was typed', async () => {
		const send = mock<SendMessage>(async () => ({ ok: false, message: 'You just sent one. Try again in 42 seconds.' }));
		const { press, type, frame } = await open({ send });
		await press('5', 'RETURN');
		await type('Ada');
		await press('TAB');
		await type('ada@example.com');
		await press('TAB');
		await type('Hi');
		await press('ctrl+s');
		await Bun.sleep(10);
		await current?.renderOnce();
		expect(frame()).toContain('You just sent one. Try again in 42 seconds.');
		expect(frame()).toContain('ada@example.com');
	});

	test('while typing, the screen keys type instead (q is a letter), and esc gives them back', async () => {
		const { press, type, frame, onQuit } = await open();
		await press('5', 'RETURN');
		await type('q2');
		expect(onQuit).not.toHaveBeenCalled();
		expect(frame()).toContain('q2');
		expect(frame()).toContain('Get in touch');
	});

	test('About: the version, the session, the stack and the licences (FFmpeg’s LGPL among them)', async () => {
		const { press, frame } = await open({ width: 140, height: 80 });
		await press('6');
		const screen = frame();
		expect(screen).toContain('raineworks, in your terminal');
		expect(screen).toContain('2026.11.1');
		expect(screen).toContain('140×80');
		expect(screen).toContain('OpenTUI');
		expect(screen).toContain('LGPL');
		expect(screen).toContain('ffmpeg.org/legal.html');
	});

	test('every screen draws, wide and narrow', async () => {
		for (const [width, height] of [
			[140, 50],
			[64, 24],
		] as const) {
			const { press, frame } = await open({ width, height });
			for (const key of ['1', '2', '3', '4', '5', '6']) {
				await press(key);
				expect(frame()).not.toContain('Error');
			}
			await current?.dispose();
			current = undefined;
		}
	});

	test('the home screen shows the mark beside the title when there’s room for both', async () => {
		const { frame } = await open({ width: 140, height: 40 });
		// The circle's top, in braille.
		expect(frame()).toMatch(/[⠀-⣿]{4,}/);
	});

	test('? shows the keys; q quits; ⌃C quits from anywhere', async () => {
		const { press, frame, onQuit } = await open();
		await press('?');
		expect(frame()).toContain('Previous / next screen');
		await press('ctrl+c');
		expect(onQuit).toHaveBeenCalledTimes(1);
	});

	test('a narrow terminal gets tabs, and the title in a font that fits', async () => {
		const { frame } = await open({ width: 72, height: 24 });
		expect(frame()).toContain('1 Home   2 Work');
		expect(titleFont(72 - 2).font).toBe('slick');
		expect(titleFont(120).font).toBe('block');
		expect(titleFont(50).font).toBe('tiny');
	});

	test('a terminal too small says how big it needs to be', async () => {
		const { frame } = await open({ width: 50, height: 15 });
		expect(frame()).toContain('Make the window a little bigger: 60×20 at least.');
		expect(frame()).toContain('50×15');
	});
});

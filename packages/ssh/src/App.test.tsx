import { describe, expect, test } from 'bun:test';
import { profile, projects } from '@marketing/content/profile';
import { render } from 'ink-testing-library';
import { App } from '@/App';
import { sanitize } from '@/sanitize';

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('App', () => {
	test('renders home first', () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain(profile.name);
	});

	test('arrow keys and number keys navigate, wrapping around', async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write('\u001B[C');
		await tick();
		expect(lastFrame()).toContain('education');
		stdin.write('3');
		await tick();
		expect(lastFrame()).toContain(projects[0]?.name ?? '');
		stdin.write('h');
		stdin.write('h');
		stdin.write('h');
		await tick();
		expect(lastFrame()).toContain(profile.contact.email);
	});
});

describe('sanitize', () => {
	test('strips escape sequences and control characters', () => {
		expect(sanitize('a\u001b[31mred\u0007\nb')).toBe('a [31mred  b');
	});
});

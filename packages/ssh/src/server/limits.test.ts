import { describe, expect, test } from 'bun:test';
import { ConnectionGuard, clampSize, defaultLimits } from '@/server/limits';

const limits = { ...defaultLimits, maxConnections: 3, maxPerIp: 2, ratePerIp: 4, rateWindowMs: 1000 };

describe('ConnectionGuard', () => {
	test('caps concurrent connections per IP and releases slots', () => {
		const guard = new ConnectionGuard(limits);
		const a = guard.admit('1.1.1.1');
		const b = guard.admit('1.1.1.1');
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		expect(guard.admit('1.1.1.1')).toBeNull();
		a?.();
		a?.(); // double release must not free a second slot
		expect(guard.admit('1.1.1.1')).not.toBeNull();
		expect(guard.admit('1.1.1.1')).toBeNull();
	});

	test('caps total connections', () => {
		const guard = new ConnectionGuard(limits);
		expect(guard.admit('1.1.1.1')).not.toBeNull();
		expect(guard.admit('2.2.2.2')).not.toBeNull();
		expect(guard.admit('3.3.3.3')).not.toBeNull();
		expect(guard.admit('4.4.4.4')).toBeNull();
	});

	test('rate limits new connections per IP, recovering after the window', () => {
		let now = 0;
		const guard = new ConnectionGuard(limits, () => now);
		for (let i = 0; i < 4; i++) guard.admit('1.1.1.1')?.();
		expect(guard.admit('1.1.1.1')).toBeNull();
		now = 1500;
		expect(guard.admit('1.1.1.1')).not.toBeNull();
	});

	test('sweep drops stale rate entries', () => {
		let now = 0;
		const guard = new ConnectionGuard(limits, () => now);
		guard.admit('1.1.1.1')?.();
		now = 5000;
		guard.sweep();
		expect(guard.admit('1.1.1.1')).not.toBeNull();
	});
});

describe('clampSize', () => {
	test('clamps hostile terminal sizes', () => {
		expect(clampSize(10000, 300, 80)).toBe(300);
		expect(clampSize(0, 300, 80)).toBe(80);
		expect(clampSize(-5, 300, 80)).toBe(80);
		expect(clampSize(Number.NaN, 300, 80)).toBe(80);
		expect(clampSize(120.9, 300, 80)).toBe(120);
	});
});

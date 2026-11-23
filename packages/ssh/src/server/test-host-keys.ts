/**
 * Fixed ed25519 host keys for the SSH package's tests, built from fixed seeds so every run uses the same keys (ssh2's
 * `utils.generateKeyPairSync('ed25519')` can't be used: it drops leading zero bytes from the public key, so about one
 * key in 256 it makes is malformed and fails to parse). The keys are encoded the way `ssh-keygen` writes them, in
 * OpenSSH's private key format, unencrypted. They're test keys only, derived from public seeds: never use them as a
 * real host key.
 *
 * @module @raineworks/ssh/server/test-host-keys
 */

import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';

/** DER prefix of a PKCS#8 ed25519 private key, before its 32-byte seed. */
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
/** Length of the DER prefix of an SPKI ed25519 public key, before its 32 bytes. */
const SPKI_PREFIX_LENGTH = 12;

/**
 * An ed25519 key pair from a fixed seed: its raw 32-byte public key, the public key as an OpenSSH line
 * (`ssh-ed25519 AAAA…`), and the private key in OpenSSH PEM.
 */
export type TestHostKey = { publicKey: Buffer; publicLine: string; pem: string };

/** An SSH `string`: a big-endian uint32 length, then the bytes. */
function sshString(value: Buffer | string): Buffer {
	const bytes = Buffer.from(value);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(bytes.length);
	return Buffer.concat([length, bytes]);
}

/** A big-endian uint32. */
function uint32(value: number): Buffer {
	const bytes = Buffer.alloc(4);
	bytes.writeUInt32BE(value);
	return bytes;
}

/**
 * Builds the ed25519 key whose seed is the SHA-256 of `label`, encoded as `ssh-keygen` would.
 *
 * @param label - Any text; the same label always gives the same key.
 * @returns The key's 32-byte public key and its unencrypted OpenSSH private key PEM (ending in a newline).
 */
export function testHostKey(label: string): TestHostKey {
	const seed = createHash('sha256').update(label).digest();
	const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
	const publicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(SPKI_PREFIX_LENGTH);
	const publicBlob = Buffer.concat([sshString('ssh-ed25519'), sshString(publicKey)]);
	// The check integer only has to repeat; a fixed one keeps the key the same every run.
	const check = uint32(0x5241494e);
	let secret = Buffer.concat([
		check,
		check,
		publicBlob,
		sshString(Buffer.concat([seed, publicKey])),
		sshString('raineworks-test'),
	]);
	// Padded to the cipher's block size ("none": 8) with 1, 2, 3, …
	const padding = Array.from({ length: (8 - (secret.length % 8)) % 8 }, (_, i) => i + 1);
	secret = Buffer.concat([secret, Buffer.from(padding)]);
	const body = Buffer.concat([
		Buffer.from('openssh-key-v1\0'),
		sshString('none'),
		sshString('none'),
		sshString(''),
		uint32(1),
		sshString(publicBlob),
		sshString(secret),
	]);
	const lines = body.toString('base64').match(/.{1,70}/g) ?? [];
	return {
		publicKey,
		publicLine: `ssh-ed25519 ${publicBlob.toString('base64')}`,
		pem: ['-----BEGIN OPENSSH PRIVATE KEY-----', ...lines, '-----END OPENSSH PRIVATE KEY-----', ''].join('\n'),
	};
}

/** The tests' everyday host key. */
export const TEST_HOST_KEY = testHostKey('host-key');

/**
 * A host key whose public key starts with a zero byte: the kind ssh2's generator mangles (so the tests failed about
 * one run in 256), and that a real `ssh-keygen` key can be. `loadHostKey` must accept it.
 */
export const LEADING_ZERO_HOST_KEY = testHostKey('leading-zero-581');

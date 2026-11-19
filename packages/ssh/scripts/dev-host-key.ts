/**
 * The host key `bun run dev` serves with: `.dev/host_key` in this package, made the first time and kept (git-ignored),
 * so a local `ssh -p 2222 localhost` sees the same key every run. It's for development only: production's key is
 * provided by the environment (`SSH_HOST_KEY` / `SSH_HOST_KEY_PATH`) and never generated.
 *
 * ed25519, like production's, through `ssh-keygen` (OpenSSH, on macOS, Linux and Windows); where that isn't installed,
 * an RSA key from Bun's crypto, which `ssh2` reads too (it can't read an ed25519 key in Node's PKCS#8 form).
 *
 * @module scripts/dev-host-key
 */

import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dir, '../.dev');
const path = join(dir, 'host_key');

if (!existsSync(path)) {
	mkdirSync(dir, { recursive: true });
	const keygen = Bun.which('ssh-keygen')
		? Bun.spawnSync(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'raineworks-dev', '-f', path])
		: null;
	if (!keygen?.success) {
		const { privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' },
		});
		await Bun.write(path, privateKey);
	}
	chmodSync(path, 0o600);
	console.log(`🔑 Made a development SSH host key: ${path}`);
}

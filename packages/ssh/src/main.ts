import { createServer, loadHostKey } from '@/server';

const keyPath = process.env.SSH_HOST_KEY_PATH;
if (!keyPath) {
	console.error('SSH_HOST_KEY_PATH is required (mounted ed25519 private key)');
	process.exit(1);
}

const port = Number(process.env.SSH_PORT ?? 2222);
const { listen } = createServer({ hostKey: loadHostKey(keyPath), port });
await listen();
console.log(`ssh listening on :${port}`);

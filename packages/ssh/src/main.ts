import { createServer, loadHostKey } from '@/server';

let hostKey: Buffer;
try {
	hostKey = loadHostKey(process.env);
} catch (error) {
	console.error(`ssh: ${(error as Error).message}`);
	process.exit(1);
}

const port = Number(process.env.SSH_PORT ?? 2222);

function intFromEnv(name: string): number | undefined {
	const raw = process.env[name];
	if (raw === undefined) return undefined;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1) {
		console.error(`${name} must be a positive integer`);
		process.exit(1);
	}
	return value;
}

const limits = {
	...(intFromEnv('SSH_MAX_CONNECTIONS') && { maxConnections: intFromEnv('SSH_MAX_CONNECTIONS') }),
	...(intFromEnv('SSH_MAX_PER_IP') && { maxPerIp: intFromEnv('SSH_MAX_PER_IP') }),
	...(intFromEnv('SSH_RATE_PER_IP') && { ratePerIp: intFromEnv('SSH_RATE_PER_IP') }),
};
const { listen } = createServer({ hostKey, port, limits });
await listen();
console.log(`ssh listening on :${port}`);

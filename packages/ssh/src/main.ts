/**
 * Process entrypoint of `ssh raineworks.com`: loads the host key and the settings (`lib/env`), and starts the SSH
 * server, each session's contact form sending through the site's API. Exits when the host key is missing or a
 * setting isn't valid.
 *
 * @module main
 */

import { env } from '@raineworks/ssh/lib/env';
import { createServer, loadHostKey } from '@raineworks/ssh/server';
import { messageSender } from '@raineworks/ssh/server/messages';
import { tryCatch } from '@raineworks/tools/prototypes';

const { data: hostKey, error } = tryCatch(() => loadHostKey(process.env));
if (error || !hostKey) {
	console.error(`ssh: ${error?.message}`);
	process.exit(1);
}

const limits = {
	...(env.SSH_MAX_CONNECTIONS && { maxConnections: env.SSH_MAX_CONNECTIONS }),
	...(env.SSH_MAX_PER_IP && { maxPerIp: env.SSH_MAX_PER_IP }),
	...(env.SSH_RATE_PER_IP && { ratePerIp: env.SSH_RATE_PER_IP }),
};
const { listen } = createServer({
	hostKey,
	port: env.SSH_PORT,
	limits,
	version: env.VERSION,
	sender: () => messageSender({ apiUrl: env.RAINEWORKS_API_URL }),
});
await listen();
console.log(`ssh listening on :${env.SSH_PORT} (messages to ${env.RAINEWORKS_API_URL})`);

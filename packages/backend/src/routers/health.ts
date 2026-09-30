import { Hono } from 'hono';

export interface HealthResponse {
	status: 'healthy';
	timestamp: string;
	uptime: number;
}

export const healthRouter = new Hono().get('/', (c) => {
	const health: HealthResponse = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	};
	return c.json(health, 200);
});

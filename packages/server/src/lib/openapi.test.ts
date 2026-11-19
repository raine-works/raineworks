import { describe, expect, test } from 'bun:test';

import { api } from '@raineworks/server/app';
import { generateSpec, tagOf } from '@raineworks/server/lib/openapi';
import { Hono } from 'hono';

/** The parts of the document these tests read. */
interface Spec {
	openapi: string;
	info: { title: string; version: string };
	tags: { name: string }[];
	paths: Record<
		string,
		Record<
			string,
			{
				operationId?: string;
				summary?: string;
				tags?: string[];
				parameters?: { name: string; in: string; required?: boolean; schema: { enum?: string[] } }[];
				requestBody?: { content: Record<string, { schema: JsonSchema }> };
				responses: Record<string, { description: string; content?: Record<string, { schema: JsonSchema }> }>;
			}
		>
	>;
}
interface JsonSchema {
	type?: string;
	required?: string[];
	properties?: Record<
		string,
		JsonSchema & { maxLength?: number; const?: unknown; enum?: unknown[]; description?: string }
	>;
}

const spec = (await generateSpec(new Hono().route('/api', api) as never, '2026.11.1 (abc1234)')) as unknown as Spec;

describe('the OpenAPI document', () => {
	test('is OpenAPI 3.1, versioned, with every /api route tagged by where it sits', () => {
		expect(spec.openapi).toStartWith('3.1');
		expect(spec.info).toMatchObject({ title: 'raineworks API', version: '2026.11.1 (abc1234)' });
		expect(Object.keys(spec.paths).sort()).toEqual(['/api/articles', '/api/build', '/api/contact', '/api/projects']);
		expect(spec.tags.map(({ name }) => name)).toEqual(['Articles', 'Build', 'Contact', 'Projects']);
		expect(spec.paths['/api/contact']?.post?.tags).toEqual(['Contact']);
		expect(tagOf('/api/contact/{id}')).toBe('Contact');
	});

	test('every operation has an id, a summary, and documents every response with its body', () => {
		for (const [path, item] of Object.entries(spec.paths)) {
			for (const [method, operation] of Object.entries(item)) {
				expect(operation.operationId, `${method} ${path}`).toBeString();
				expect(operation.summary, `${method} ${path}`).toBeString();
				for (const [status, response] of Object.entries(operation.responses)) {
					expect(response.description, `${method} ${path} ${status}`).not.toBeEmpty();
					expect(response.content?.['application/json']?.schema, `${method} ${path} ${status}`).toBeDefined();
				}
			}
		}
	});

	test('the contact form’s request body is the shared schema, its limits included', () => {
		const body = spec.paths['/api/contact']?.post?.requestBody?.content['application/json']?.schema;
		expect(body?.required?.sort()).toEqual(['email', 'message', 'name']);
		expect(body?.properties?.name?.maxLength).toBe(200);
		expect(body?.properties?.email?.maxLength).toBe(320);
		expect(body?.properties?.message?.maxLength).toBe(5000);
		expect(Object.keys(spec.paths['/api/contact']?.post?.responses ?? {}).sort()).toEqual(['202', '400', '413', '500']);
	});

	test('an error is documented as the body every refusal shares, with its exact code', () => {
		const tooLarge = spec.paths['/api/contact']?.post?.responses['413']?.content?.['application/json']?.schema;
		const error = tooLarge?.properties?.error;
		expect(error?.required?.sort()).toEqual(['code', 'message']);
		expect(error?.properties?.code?.const).toBe('payload_too_large');
	});

	test('the build route documents its query and its answer', () => {
		const get = spec.paths['/api/build']?.get;
		expect(get?.parameters).toEqual([
			expect.objectContaining({
				name: 'zone',
				in: 'query',
				required: true,
				schema: expect.objectContaining({ enum: ['marketing'] }),
			}),
		]);
		const answer = get?.responses['200']?.content?.['application/json']?.schema;
		expect(Object.keys(answer?.properties ?? {}).sort()).toEqual(['build', 'commit', 'version']);
	});
});

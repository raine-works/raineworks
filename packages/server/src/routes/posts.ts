/**
 * Post routes.
 *
 * CRUD endpoints for managing posts. All routes are public in this
 * starter scaffold — add an auth guard middleware to protect write
 * operations once authentication is wired up.
 *
 * @module routes/posts
 */

import { ORPCError } from '@orpc/server';
import { recordNotFound, uniqueViolation } from '@rainestack/database/errors';
import * as postsData from '@server/data/posts';
import * as usersData from '@server/data/users';
import { publicProcedure } from '@server/lib/orpc';
import {
	CreatePostInputSchema,
	IdParamsSchema,
	ListPostsParamsSchema,
	PostListSchema,
	PostSchema,
	SlugParamsSchema,
	UpdatePostInputSchema
} from '@server/lib/schemas';

// ---------------------------------------------------------------------------
// List posts
// ---------------------------------------------------------------------------

const list = publicProcedure
	.input(ListPostsParamsSchema)
	.output(PostListSchema)
	.route({ method: 'GET', path: '/posts' })
	.handler(async ({ context, input }) => {
		return postsData.list(context.db, input);
	});

// ---------------------------------------------------------------------------
// Get post by ID
// ---------------------------------------------------------------------------

const getById = publicProcedure
	.input(IdParamsSchema)
	.output(PostSchema)
	.route({ method: 'GET', path: '/posts/{id}' })
	.handler(async ({ context, input }) => {
		const post = await postsData.findById(context.db, input.id);

		if (!post) {
			throw new ORPCError('NOT_FOUND', { message: `Post ${input.id} not found` });
		}

		return post;
	});

// ---------------------------------------------------------------------------
// Get post by slug
// ---------------------------------------------------------------------------

const getBySlug = publicProcedure
	.input(SlugParamsSchema)
	.output(PostSchema)
	.route({ method: 'GET', path: '/posts/by-slug/{slug}' })
	.handler(async ({ context, input }) => {
		const post = await postsData.findBySlug(context.db, input.slug);

		if (!post) {
			throw new ORPCError('NOT_FOUND', { message: `Post with slug "${input.slug}" not found` });
		}

		return post;
	});

// ---------------------------------------------------------------------------
// Create post
// ---------------------------------------------------------------------------

const create = publicProcedure
	.input(CreatePostInputSchema)
	.output(PostSchema)
	.route({ method: 'POST', path: '/posts' })
	.handler(async ({ context, input }) => {
		const { db, actorId } = context;

		// In a real app the authorId would come from context.user.id.
		// For this scaffold, we pick the first user or throw.
		const firstUser = await usersData.findFirst(db);
		if (!firstUser) {
			throw new ORPCError('BAD_REQUEST', { message: 'No users exist yet — create a user first' });
		}

		try {
			return await postsData.create(db, actorId, {
				title: input.title,
				slug: input.slug,
				content: input.content,
				excerpt: input.excerpt,
				status: input.status,
				authorId: firstUser.id
			});
		} catch (error) {
			if (uniqueViolation(error)) {
				throw new ORPCError('CONFLICT', { message: `A post with slug "${input.slug}" already exists` });
			}
			throw error;
		}
	});

// ---------------------------------------------------------------------------
// Update post
// ---------------------------------------------------------------------------

const update = publicProcedure
	.input(UpdatePostInputSchema)
	.output(PostSchema)
	.route({ method: 'PATCH', path: '/posts/{id}' })
	.handler(async ({ context, input }) => {
		const { db, actorId } = context;

		try {
			return await postsData.update(db, actorId, input.id, {
				title: input.title,
				slug: input.slug,
				content: input.content,
				excerpt: input.excerpt,
				status: input.status
			});
		} catch (error) {
			if (recordNotFound(error)) {
				throw new ORPCError('NOT_FOUND', { message: `Post ${input.id} not found` });
			}
			if (uniqueViolation(error)) {
				throw new ORPCError('CONFLICT', { message: `A post with slug "${input.slug}" already exists` });
			}
			throw error;
		}
	});

// ---------------------------------------------------------------------------
// Delete post
// ---------------------------------------------------------------------------

const remove = publicProcedure
	.input(IdParamsSchema)
	.output(PostSchema)
	.route({ method: 'DELETE', path: '/posts/{id}' })
	.handler(async ({ context, input }) => {
		const { db, actorId } = context;

		// Fetch the full record (with author) for the response body —
		// postsData.remove returns the bare row without relations.
		const post = await postsData.findById(db, input.id);

		if (!post) {
			throw new ORPCError('NOT_FOUND', { message: `Post ${input.id} not found` });
		}

		try {
			await postsData.remove(db, actorId, input.id);
		} catch (error) {
			if (recordNotFound(error)) {
				throw new ORPCError('NOT_FOUND', { message: `Post ${input.id} not found` });
			}
			throw error;
		}

		return post;
	});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const postRouter = {
	list,
	getById,
	getBySlug,
	create,
	update,
	remove
};

/**
 * Post data-access layer.
 *
 * Pure database operations for the `Post` model. Every function
 * accepts a `db` parameter (either the singleton client or a
 * transaction client from `withActor`) so that callers control
 * the connection and transaction boundary.
 *
 * All mutation functions accept an `actorId` parameter and wrap their
 * operations in {@link withActor} so audit triggers attribute changes
 * to the correct user. Because `withActor` is nestable (it passes
 * through when `db` is already a transaction client), these functions
 * work both standalone and when composed inside a larger transaction.
 *
 * @module data/posts
 */

import type { Prisma } from '@database/generated/prisma/client';
import type { PrismaClient } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shorthand for the Prisma client or transaction client. */
type Db = PrismaClient;

export interface CreatePostData {
	title: string;
	slug: string;
	content?: string;
	excerpt?: string;
	status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
	authorId: string;
}

export interface UpdatePostData {
	title?: string;
	slug?: string;
	content?: string | null;
	excerpt?: string | null;
	status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface ListPostsOptions {
	page: number;
	limit: number;
	status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
	authorId?: string;
	search?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Find a post by its CUID. */
export async function findById(db: Db, id: string) {
	return db.post.findUnique({
		where: { id },
		include: { author: true }
	});
}

/** Find a post by its unique slug. */
export async function findBySlug(db: Db, slug: string) {
	return db.post.findUnique({
		where: { slug },
		include: { author: true }
	});
}

/** Paginated post listing with optional filters. */
export async function list(db: Db, options: ListPostsOptions) {
	const { page, limit, status, authorId, search } = options;
	const skip = (page - 1) * limit;

	const where: Prisma.PostWhereInput = {};

	if (status) {
		where.status = status;
	}

	if (authorId) {
		where.authorId = authorId;
	}

	if (search) {
		where.OR = [
			{ title: { contains: search, mode: 'insensitive' } },
			{ excerpt: { contains: search, mode: 'insensitive' } }
		];
	}

	const [posts, total] = await Promise.all([
		db.post.findMany({
			where,
			include: { author: true },
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit
		}),
		db.post.count({ where })
	]);

	return {
		posts,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		}
	};
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new post. */
export async function create(db: Db, actorId: string | null, data: CreatePostData) {
	return withActor(db, actorId, async (tx) => {
		return tx.post.create({
			data: {
				title: data.title,
				slug: data.slug,
				content: data.content,
				excerpt: data.excerpt,
				status: data.status ?? 'DRAFT',
				publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
				authorId: data.authorId
			},
			include: { author: true }
		});
	});
}

/** Update an existing post. Sets `publishedAt` when transitioning to PUBLISHED. */
export async function update(db: Db, actorId: string | null, id: string, data: UpdatePostData) {
	return withActor(db, actorId, async (tx) => {
		// If transitioning to PUBLISHED and publishedAt is not already set,
		// record the publication timestamp.
		const updateData: Record<string, unknown> = { ...data };

		if (data.status === 'PUBLISHED') {
			const existing = await tx.post.findUnique({
				where: { id },
				select: { publishedAt: true }
			});
			if (existing && !existing.publishedAt) {
				updateData.publishedAt = new Date();
			}
		}

		return tx.post.update({
			where: { id },
			data: updateData,
			include: { author: true }
		});
	});
}

/** Delete a post by ID. Returns the deleted post. */
export async function remove(db: Db, actorId: string | null, id: string) {
	return withActor(db, actorId, async (tx) => {
		return tx.post.delete({
			where: { id }
		});
	});
}

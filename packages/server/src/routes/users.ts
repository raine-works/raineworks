/**
 * User routes.
 *
 * CRUD operations for the User model. All routes are public for now —
 * add an `authedProcedure` guard when authentication is implemented.
 *
 * @module routes/users
 */

import { ORPCError } from '@orpc/server';
import { recordNotFound, uniqueViolation } from '@rainestack/database/errors';
import * as usersData from '@server/data/users';
import { publicProcedure } from '@server/lib/orpc';
import {
	CreateUserInputSchema,
	IdParamsSchema,
	ListUsersParamsSchema,
	UpdateUserInputSchema,
	UserListSchema,
	UserSchema
} from '@server/lib/schemas';

// ---------------------------------------------------------------------------
// List users
// ---------------------------------------------------------------------------

const list = publicProcedure
	.input(ListUsersParamsSchema)
	.output(UserListSchema)
	.route({ method: 'GET', path: '/users' })
	.handler(async ({ context, input }) => {
		return usersData.list(context.db, input);
	});

// ---------------------------------------------------------------------------
// Get user by ID
// ---------------------------------------------------------------------------

const getById = publicProcedure
	.input(IdParamsSchema)
	.output(UserSchema)
	.route({ method: 'GET', path: '/users/{id}' })
	.handler(async ({ context, input }) => {
		const user = await usersData.findById(context.db, input.id);

		if (!user) {
			throw new ORPCError('NOT_FOUND', { message: 'User not found' });
		}

		return user;
	});

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------

const create = publicProcedure
	.input(CreateUserInputSchema)
	.output(UserSchema)
	.route({ method: 'POST', path: '/users' })
	.handler(async ({ context, input }) => {
		try {
			return await usersData.create(context.db, context.actorId, input);
		} catch (error) {
			if (uniqueViolation(error)) {
				throw new ORPCError('CONFLICT', { message: 'A user with this email already exists' });
			}
			throw error;
		}
	});

// ---------------------------------------------------------------------------
// Update user
// ---------------------------------------------------------------------------

const update = publicProcedure
	.input(UpdateUserInputSchema)
	.output(UserSchema)
	.route({ method: 'PATCH', path: '/users/{id}' })
	.handler(async ({ context, input }) => {
		const { id, ...data } = input;

		try {
			return await usersData.update(context.db, context.actorId, id, data);
		} catch (error) {
			if (recordNotFound(error)) {
				throw new ORPCError('NOT_FOUND', { message: 'User not found' });
			}
			throw error;
		}
	});

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

const remove = publicProcedure
	.input(IdParamsSchema)
	.output(UserSchema)
	.route({ method: 'DELETE', path: '/users/{id}' })
	.handler(async ({ context, input }) => {
		try {
			return await usersData.remove(context.db, context.actorId, input.id);
		} catch (error) {
			if (recordNotFound(error)) {
				throw new ORPCError('NOT_FOUND', { message: 'User not found' });
			}
			throw error;
		}
	});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const userRouter = {
	list,
	getById,
	create,
	update,
	delete: remove
};

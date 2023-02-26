import { MyContext } from 'src/types';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import argon2 from 'argon2';
import { COOKIE_NAME } from '../constants';
import { User } from '@prisma/client';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegister } from '../util/validateRegister';

@ObjectType()
export class UserType {
	@Field()
	id: number;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;

	@Field()
	username: string;

	@Field()
	email: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => UserType, { nullable: true })
	user?: UserType;
}

@ObjectType()
class FieldError {
	@Field()
	field: string;

	@Field()
	message: string;
}

@Resolver()
export class UserResolver {
	// create a me query
	@Query(() => UserType, { nullable: true })
	async me(@Ctx() { prisma, req }: MyContext) {
		// you are not logged in
		if (!req.session.userId) {
			return null;
		}

		const user = await prisma.user.findUnique({
			where: {
				id: req.session.userId,
			},
		});

		return user;
	}

	@Mutation(() => UserResponse)
	async register(
		@Arg('options') options: UsernamePasswordInput,
		@Ctx() { prisma, req }: MyContext
	): Promise<UserResponse> {
		const errors = validateRegister(options);
		if (errors) {
			return { errors };
		}

		const hashedPassword = await argon2.hash(options.password);
		let user;
		try {
			user = await prisma.user.create({
				data: {
					username: options.username,
					password: hashedPassword,
					email: options.email,
				},
			});
		} catch (error) {
			if (error.code === 'P2002') {
				// duplicate username error
				return {
					errors: [
						{
							field: 'username',
							message: 'Username already taken',
						},
					],
				};
			}
		}

		req.session.userId = user?.id;

		return {
			user,
		};
	}

	@Mutation(() => UserResponse)
	async login(
		@Arg('usernameOrEmail') usernameOrEmail: string,
		@Arg('password') password: string,
		@Ctx() { prisma, req }: MyContext
	): Promise<UserResponse> {
		let user: User | null;

		if (usernameOrEmail.includes('@')) {
			user = await prisma.user.findUnique({
				where: {
					email: usernameOrEmail,
				},
			});
		} else {
			user = await prisma.user.findUnique({
				where: {
					username: usernameOrEmail,
				},
			});
		}

		if (!user) {
			return {
				errors: [
					{
						field: 'usernameOrEmail',
						message: 'That user does not exist',
					},
				],
			};
		}

		if (!(await argon2.verify(user.password, password))) {
			return {
				errors: [
					{
						field: 'password',
						message: 'Incorrect password',
					},
				],
			};
		}

		req.session.userId = user.id;

		return {
			user,
		};
	}

	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise(resolve =>
			req.session.destroy(err => {
				res.clearCookie(COOKIE_NAME);
				if (err) {
					console.log(err);
					resolve(false);
					return;
				}

				resolve(true);
			})
		);
	}
}

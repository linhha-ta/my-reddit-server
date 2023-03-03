import { MyContext } from 'src/types';
import { Arg, Ctx, FieldResolver, Mutation, Query, Resolver, Root } from 'type-graphql';
import argon2 from 'argon2';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { User } from '@prisma/client';
import { validateRegister } from '../util/validateRegister';
import { sendEmail } from '../util/sendEmail';
import { v4 as uuidv4 } from 'uuid';
import { UserType } from '../schemas/UserType';
import { UserResponse } from '../schemas/UserResponse';
import { UsernamePasswordInput } from '../schemas/UsernamePasswordInput';

@Resolver(UserType)
export class UserResolver {
	@FieldResolver(() => String)
	email(@Root() user: UserType, @Ctx() { req }: MyContext) {
		// this is the current user and its ok to show them their own email
		if (req.session.userId === user.id) {
			return user.email;
		}
		// current user wants to see someone elses email
		return '';
	}

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

	@Mutation(() => Boolean)
	async forgotPassword(@Arg('email') email: string, @Ctx() { prisma, redisClient }: MyContext) {
		const user = await prisma.user.findUnique({
			where: {
				email,
			},
		});

		if (!user) {
			return true;
		}

		const token = uuidv4();
		await redisClient.set(FORGET_PASSWORD_PREFIX + token, user.id, 'EX', 1000 * 60 * 60 * 24 * 3);

		const html = `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`;
		await sendEmail(user.email, html);

		return true;
	}

	@Mutation(() => UserResponse)
	async changePassword(
		@Arg('token') token: string,
		@Arg('newPassword') newPassword: string,
		@Ctx() { prisma, redisClient, req }: MyContext
	): Promise<UserResponse> {
		if (newPassword.length <= 2) {
			return {
				errors: [
					{
						field: 'newPassword',
						message: 'Password must be greater than 2',
					},
				],
			};
		}

		const key = FORGET_PASSWORD_PREFIX + token;
		const userId = await redisClient.get(key);
		if (!userId) {
			return {
				errors: [
					{
						field: 'token',
						message: 'Token expired',
					},
				],
			};
		}

		const user = await prisma.user.findUnique({
			where: {
				id: parseInt(userId),
			},
		});

		if (!user) {
			return {
				errors: [
					{
						field: 'token',
						message: 'User no longer exists',
					},
				],
			};
		}

		await prisma.user.update({
			where: {
				id: parseInt(userId),
			},
			data: {
				password: await argon2.hash(newPassword),
			},
		});

		await redisClient.del(key);

		// log in user after change password
		req.session.userId = user.id;

		return {
			user,
		};
	}
}

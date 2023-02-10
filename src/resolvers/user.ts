import { MyContext } from 'src/types';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver } from 'type-graphql';
import argon2 from 'argon2';

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
}

@InputType()
class UsernamePasswordInput {
	@Field()
	username: string;

	@Field()
	password: string;
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
	@Mutation(() => UserResponse)
	async register(
		@Arg('options') options: UsernamePasswordInput,
		@Ctx() { prisma }: MyContext
	): Promise<UserResponse> {
		if (options.username.length <= 2) {
			return {
				errors: [
					{
						field: 'username',
						message: 'Username must be at least 3 characters long',
					},
				],
			};
		}

		if (options.password.length <= 2) {
			return {
				errors: [
					{
						field: 'password',
						message: 'Password must be at least 2 characters long',
					},
				],
			};
		}

		const hashedPassword = await argon2.hash(options.password);
		let user;
		try {
			user = await prisma.user.create({
				data: {
					username: options.username,
					password: hashedPassword,
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

		return {
			user,
		};
	}

	@Mutation(() => UserResponse)
	async login(@Arg('options') options: UsernamePasswordInput, @Ctx() { prisma }: MyContext): Promise<UserResponse> {
		const user = await prisma.user.findUnique({
			where: {
				username: options.username,
			},
		});

		if (!user) {
			return {
				errors: [
					{
						field: 'username',
						message: 'That username does not exist',
					},
				],
			};
		}

		if (!(await argon2.verify(user.password, options.password))) {
			return {
				errors: [
					{
						field: 'password',
						message: 'Incorrect password',
					},
				],
			};
		}

		return {
			user,
		};
	}
}

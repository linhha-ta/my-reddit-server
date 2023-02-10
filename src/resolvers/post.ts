import { Arg, Ctx, Int, Mutation, Query, Resolver } from 'type-graphql';
import { ObjectType, Field } from 'type-graphql';
import { MyContext } from 'src/types';

// we need to create a class that will be used as a type
// for the graphql schema by adding the @ObjectType() decorator
@ObjectType()
export class PostType {
	// we need to add the @Field() decorator to each property
	// that we want to expose in the graphql schema
	@Field()
	id: number;

	@Field()
	title: string;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}

// a resolver is a class that contains methods that will be used
// to resolve the queries and mutations that we will define in the schema
@Resolver()
export class PostResolver {
	@Query(() => [PostType])
	async posts(@Ctx() { prisma }: MyContext): Promise<PostType[]> {
		return await prisma.post.findMany();
	}

	@Query(() => PostType, { nullable: true })
	async post(@Arg('id', () => Int) id: number, @Ctx() { prisma }: MyContext): Promise<PostType | null> {
		return await prisma.post.findUnique({
			where: {
				id: id,
			},
		});
	}

	@Mutation(() => PostType)
	async createPost(@Arg('title') title: string, @Ctx() { prisma }: MyContext): Promise<PostType> {
		return await prisma.post.create({
			data: {
				title,
			},
		});
	}

	@Mutation(() => PostType, { nullable: true })
	async updatePost(
		@Arg('id') id: number,
		@Arg('title') title: string,
		@Ctx() { prisma }: MyContext
	): Promise<PostType | null> {
		const post = await prisma.post.findUnique({
			where: {
				id,
			},
		});

		if (!post) {
			return null;
		}

		if (title === post.title) {
			return post;
		}

		return await prisma.post.update({
			where: {
				id,
			},
			data: {
				title,
			},
		});
	}

	@Mutation(() => Boolean)
	async deletePost(@Arg('id') id: number, @Ctx() { prisma }: MyContext): Promise<boolean> {
		const post = await prisma.post.findUnique({
			where: {
				id,
			},
		});

		if (!post) {
			return false;
		}

		await prisma.post.delete({
			where: {
				id,
			},
		});

		return true;
	}
}

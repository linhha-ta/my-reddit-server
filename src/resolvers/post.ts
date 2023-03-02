import { Arg, Ctx, Int, Mutation, Query, Resolver } from 'type-graphql';
import { MyContext } from '../types';
import { PostType } from '../schemas/PostType';

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
	async createPost(
		@Arg('title') title: string,
		@Arg('text') text: string,
		@Arg('authorId') authorId: number,
		@Ctx() { prisma }: MyContext
	): Promise<PostType> {
		return await prisma.post.create({
			data: {
				title,
				text,
				authorId,
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

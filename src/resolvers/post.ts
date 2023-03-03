import { Arg, Ctx, FieldResolver, Int, Mutation, Query, Resolver, Root, UseMiddleware } from 'type-graphql';
import { MyContext } from '../types';
import { PostType } from '../schemas/PostType';
import { isAuth } from '../middleware/isAuth';

// a resolver is a class that contains methods that will be used
// to resolve the queries and mutations that we will define in the schema
@Resolver(PostType)
export class PostResolver {
	@FieldResolver(() => String)
	textSnippet(@Root() root: PostType) {
		return root.text.slice(0, 50);
	}

	@Query(() => [PostType])
	async posts(
		@Arg('limit', () => Int) limit: number,
		@Arg('cursor', () => String, { nullable: true }) cursor: string | null,
		@Ctx() { prisma }: MyContext
	): Promise<PostType[]> {
		const realLimit = Math.min(50, limit);
		return await prisma.post.findMany({
			where: {
				createdAt: {
					lt: cursor ? new Date(cursor) : new Date(),
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
			take: realLimit,
		});
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
	@UseMiddleware(isAuth)
	async createPost(
		@Arg('title') title: string,
		@Arg('text') text: string,
		@Ctx() { prisma, req }: MyContext
	): Promise<PostType> {
		return await prisma.post.create({
			data: {
				title,
				text,
				authorId: req.session.userId as number,
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

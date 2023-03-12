import { Arg, Ctx, FieldResolver, Int, Mutation, Query, Resolver, Root, UseMiddleware } from 'type-graphql';
import { MyContext } from '../types';
import { PostType } from '../schemas/PostType';
import { isAuth } from '../middleware/isAuth';
import { PaginatedPosts } from '../schemas/PaginatedPosts';

// a resolver is a class that contains methods that will be used
// to resolve the queries and mutations that we will define in the schema
@Resolver(PostType)
export class PostResolver {
	@FieldResolver(() => String)
	textSnippet(@Root() root: PostType) {
		return root.text.slice(0, 50);
	}

	@Query(() => PaginatedPosts)
	async posts(
		@Arg('limit', () => Int) limit: number,
		@Arg('cursor', () => String, { nullable: true }) cursor: string | null,
		@Ctx() { prisma, req }: MyContext
	): Promise<PaginatedPosts> {
		const realLimit = Math.min(50, limit);
		const realLimitPlusOne = realLimit + 1;

		const posts = await prisma.post.findMany({
			where: {
				createdAt: {
					lt: cursor ? new Date(cursor) : new Date(),
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
			take: realLimitPlusOne,
			include: {
				updoots: true,
				author: {
					select: {
						id: true,
						username: true,
						email: true,
						updoots: true,
					},
				},
			},
		});

		// each post will have a voteStatus property that will be
		// either 1, -1, or 0 depending on whether the user has
		// upvoted, downvoted, or not voted on the post
		// if the user is not logged in, the voteStatus will be null

		const postsWithVoteStatus = posts.map(post => {
			if (!req.session.userId) {
				return {
					...post,
					voteStatus: null,
				};
			}

			const updoot = post.updoots.find(updoot => updoot.userId === req.session.userId);

			if (updoot) {
				return {
					...post,
					voteStatus: updoot.value,
				};
			}

			return {
				...post,
				voteStatus: null,
			};
		});

		return {
			posts: postsWithVoteStatus.slice(0, realLimit),
			hasMore: posts.length === realLimitPlusOne,
		};
	}

	@Query(() => PostType, { nullable: true })
	async post(@Arg('id', () => Int) id: number, @Ctx() { prisma }: MyContext): Promise<PostType | null> {
		const post = await prisma.post.findUnique({
			where: {
				id: id,
			},
			include: {
				updoots: true,
				author: {
					select: {
						id: true,
						username: true,
						email: true,
						updoots: true,
					},
				},
			},
		});

		return post;
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
				authorId: req.session.userId!,
			},
			include: {
				updoots: true,
				author: {
					select: {
						id: true,
						username: true,
						email: true,
						updoots: true,
					},
				},
			},
		});
	}

	@Mutation(() => PostType, { nullable: true })
	@UseMiddleware(isAuth)
	async updatePost(
		@Arg('id', () => Int) id: number,
		@Arg('title') title: string,
		@Arg('text') text: string,
		@Ctx() { prisma }: MyContext
	): Promise<PostType | null> {
		const post = await prisma.post.findUnique({
			where: {
				id,
			},
			include: {
				updoots: true,
				author: {
					select: {
						id: true,
						username: true,
						email: true,
						updoots: true,
					},
				},
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
				text,
			},
			include: {
				updoots: true,
				author: {
					select: {
						id: true,
						username: true,
						email: true,
						updoots: true,
					},
				},
			},
		});
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async deletePost(@Arg('id', () => Int) id: number, @Ctx() { prisma, req }: MyContext): Promise<boolean> {
		const { userId } = req.session;

		const post = await prisma.post.findUnique({
			where: {
				id,
			},
		});

		if (!post) {
			return false;
		}

		if (post.authorId !== userId) {
			return false;
		}

		await prisma.post.delete({
			where: {
				id,
			},
		});

		return true;
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async vote(
		@Arg('postId', () => Int) postId: number,
		@Arg('value', () => Int) value: number,
		@Ctx() { prisma, req }: MyContext
	): Promise<boolean> {
		// wenn value 0 ist soll es früh returnen
		if (value === 0) {
			return false;
		}

		// wenn es value negativ ist soll es -1 sein
		// wenn value positiv ist soll es 1 sein
		const isUpdoot = value > 0;
		const realValue = isUpdoot ? 1 : -1;
		const { userId } = req.session;

		// check if the user has already voted on the post
		const updoot = await prisma.updoot.findUnique({
			where: {
				postId_userId: {
					postId,
					userId: userId!,
				},
			},
		});

		// the user has voted on the post before
		// and they are changing their vote
		if (updoot && updoot.value !== realValue) {
			// we use a transaction to make sure both queries are executed or none of them
			await prisma.$transaction([
				prisma.updoot.update({
					where: {
						postId_userId: {
							postId,
							userId: userId!,
						},
					},
					data: {
						value: realValue,
					},
				}),
				prisma.post.update({
					where: {
						id: postId,
					},
					data: {
						points: {
							increment: realValue * 2,
						},
					},
				}),
			]);

			// the user has not voted on the post before
		} else if (!updoot) {
			// we use a transaction to make sure both queries are executed or none of them
			await prisma.$transaction([
				prisma.updoot.create({
					data: {
						postId,
						userId: userId!,
						value: realValue,
					},
				}),
				prisma.post.update({
					where: {
						id: postId,
					},
					data: {
						points: {
							increment: realValue,
						},
					},
				}),
			]);
		} else if (updoot && updoot.value === realValue) {
			await prisma.$transaction([
				prisma.updoot.delete({
					where: {
						postId_userId: {
							postId,
							userId: userId!,
						},
					},
				}),
				prisma.post.update({
					where: {
						id: postId,
					},
					data: {
						points: {
							decrement: realValue,
						},
					},
				}),
			]);
		}

		return true;
	}
}

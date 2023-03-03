import { Field, ObjectType } from 'type-graphql';
import { PostType } from './PostType';

@ObjectType()
export class PaginatedPosts {
	@Field(() => [PostType])
	posts: PostType[];

	@Field()
	hasMore: boolean;
}

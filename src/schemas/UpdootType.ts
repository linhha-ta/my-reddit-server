import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class UpdootType {
	@Field()
	userId: number;

	@Field()
	postId: number;

	@Field()
	value: number;
}

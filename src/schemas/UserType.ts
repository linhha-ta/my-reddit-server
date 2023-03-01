import { ObjectType, Field } from 'type-graphql';

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

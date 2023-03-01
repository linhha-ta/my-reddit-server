import { ObjectType, Field } from 'type-graphql';

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

import { ObjectType, Field } from 'type-graphql';
import { FieldError } from './FieldError';
import { UserType } from './UserType';

@ObjectType()
export class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => UserType, { nullable: true })
	user?: UserType;
}

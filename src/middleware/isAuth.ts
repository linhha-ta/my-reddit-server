import { MyContext } from 'src/types';
import { MiddlewareFn } from 'type-graphql';

export const isAuth: MiddlewareFn<MyContext> = ({ context }, next) => {
	console.log('isAuth middleware: ', context.req.session.userId);
	if (context.req.session.userId === undefined) {
		throw new Error('Not authenticated');
	}
	return next();
};

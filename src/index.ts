import 'reflect-metadata';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import {
	ApolloServerPluginLandingPageLocalDefault,
	ApolloServerPluginLandingPageProductionDefault,
} from 'apollo-server-core';

import { PrismaClient } from '@prisma/client';
import { buildSchema } from 'type-graphql';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import { COOKIE_NAME, __prod__ } from './constants';
import { MyContext } from './types';

import session from 'express-session';
import connectRedis from 'connect-redis';
import { createClient } from 'redis';

import cors from 'cors';

const prisma = new PrismaClient();

let plugins: any = [];
if (__prod__) {
	plugins = [
		ApolloServerPluginLandingPageProductionDefault({
			embed: true,
			graphRef: 'myGraph@prod',
			includeCookies: true,
		}),
	];
} else {
	plugins = [
		ApolloServerPluginLandingPageLocalDefault({
			embed: true,
			includeCookies: true,
		}),
	];
}

const main = async () => {
	const app = express();

	const RedisStore = connectRedis(session);
	const redisClient = createClient({ legacyMode: true });
	redisClient.connect().catch(console.error);

	app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

	app.use(
		session({
			name: COOKIE_NAME,
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
				httpOnly: true,
				sameSite: 'lax', // lax für csrf
				secure: __prod__, // cookie only works in https
			},
			secret: process.env.SESSION_SECRET as string,
			store: new RedisStore({ client: redisClient }),
			saveUninitialized: false,
			resave: false,
		})
	);

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [PostResolver, UserResolver],
			validate: false,
		}),
		plugins,
		context: ({ req, res }): MyContext => ({ prisma, req, res }),
	});

	await apolloServer.start();
	apolloServer.applyMiddleware({ app, cors: false });

	app.listen(4000, () => {
		console.log('Server is running on http://localhost:4000');
	});
};

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async e => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});

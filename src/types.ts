import { Prisma, PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { Session, SessionData } from 'express-session';
import { Redis } from 'ioredis';

export type MyContext = {
	prisma: PrismaClient<
		Prisma.PrismaClientOptions,
		never,
		Prisma.RejectOnNotFound | Prisma.RejectPerOperation | undefined
	>;
	req: Request & {
		session: Session & Partial<SessionData> & { userId?: number };
	};
	res: Response;
	redisClient: Redis;
};

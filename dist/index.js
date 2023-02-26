"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
const apollo_server_core_1 = require("apollo-server-core");
const client_1 = require("@prisma/client");
const type_graphql_1 = require("type-graphql");
const post_1 = require("./resolvers/post");
const user_1 = require("./resolvers/user");
const constants_1 = require("./constants");
const express_session_1 = __importDefault(require("express-session"));
const connect_redis_1 = __importDefault(require("connect-redis"));
const ioredis_1 = __importDefault(require("ioredis"));
const cors_1 = __importDefault(require("cors"));
const prisma = new client_1.PrismaClient();
let plugins = [];
if (constants_1.__prod__) {
    plugins = [
        (0, apollo_server_core_1.ApolloServerPluginLandingPageProductionDefault)({
            embed: true,
            graphRef: 'myGraph@prod',
            includeCookies: true,
        }),
    ];
}
else {
    plugins = [
        (0, apollo_server_core_1.ApolloServerPluginLandingPageLocalDefault)({
            embed: true,
            includeCookies: true,
        }),
    ];
}
const main = async () => {
    const app = (0, express_1.default)();
    const RedisStore = (0, connect_redis_1.default)(express_session_1.default);
    const redisClient = new ioredis_1.default();
    app.use((0, cors_1.default)({ origin: 'http://localhost:3000', credentials: true }));
    app.use((0, express_session_1.default)({
        name: constants_1.COOKIE_NAME,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
            httpOnly: true,
            sameSite: 'lax',
            secure: constants_1.__prod__,
        },
        secret: process.env.SESSION_SECRET,
        store: new RedisStore({ client: redisClient }),
        saveUninitialized: false,
        resave: false,
    }));
    const apolloServer = new apollo_server_express_1.ApolloServer({
        schema: await (0, type_graphql_1.buildSchema)({
            resolvers: [post_1.PostResolver, user_1.UserResolver],
            validate: false,
        }),
        plugins,
        context: ({ req, res }) => ({ prisma, req, res, redisClient }),
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
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=index.js.map
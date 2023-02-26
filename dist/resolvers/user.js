"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResolver = exports.UserType = void 0;
const type_graphql_1 = require("type-graphql");
const argon2_1 = __importDefault(require("argon2"));
const constants_1 = require("../constants");
const UsernamePasswordInput_1 = require("./UsernamePasswordInput");
const validateRegister_1 = require("../util/validateRegister");
const sendEmail_1 = require("../util/sendEmail");
const uuid_1 = require("uuid");
let UserType = class UserType {
};
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Number)
], UserType.prototype, "id", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], UserType.prototype, "createdAt", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", Date)
], UserType.prototype, "updatedAt", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UserType.prototype, "username", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], UserType.prototype, "email", void 0);
UserType = __decorate([
    (0, type_graphql_1.ObjectType)()
], UserType);
exports.UserType = UserType;
let UserResponse = class UserResponse {
};
__decorate([
    (0, type_graphql_1.Field)(() => [FieldError], { nullable: true }),
    __metadata("design:type", Array)
], UserResponse.prototype, "errors", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => UserType, { nullable: true }),
    __metadata("design:type", UserType)
], UserResponse.prototype, "user", void 0);
UserResponse = __decorate([
    (0, type_graphql_1.ObjectType)()
], UserResponse);
let FieldError = class FieldError {
};
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], FieldError.prototype, "field", void 0);
__decorate([
    (0, type_graphql_1.Field)(),
    __metadata("design:type", String)
], FieldError.prototype, "message", void 0);
FieldError = __decorate([
    (0, type_graphql_1.ObjectType)()
], FieldError);
let UserResolver = class UserResolver {
    async me({ prisma, req }) {
        if (!req.session.userId) {
            return null;
        }
        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId,
            },
        });
        return user;
    }
    async register(options, { prisma, req }) {
        const errors = (0, validateRegister_1.validateRegister)(options);
        if (errors) {
            return { errors };
        }
        const hashedPassword = await argon2_1.default.hash(options.password);
        let user;
        try {
            user = await prisma.user.create({
                data: {
                    username: options.username,
                    password: hashedPassword,
                    email: options.email,
                },
            });
        }
        catch (error) {
            if (error.code === 'P2002') {
                return {
                    errors: [
                        {
                            field: 'username',
                            message: 'Username already taken',
                        },
                    ],
                };
            }
        }
        req.session.userId = user === null || user === void 0 ? void 0 : user.id;
        return {
            user,
        };
    }
    async login(usernameOrEmail, password, { prisma, req }) {
        let user;
        if (usernameOrEmail.includes('@')) {
            user = await prisma.user.findUnique({
                where: {
                    email: usernameOrEmail,
                },
            });
        }
        else {
            user = await prisma.user.findUnique({
                where: {
                    username: usernameOrEmail,
                },
            });
        }
        if (!user) {
            return {
                errors: [
                    {
                        field: 'usernameOrEmail',
                        message: 'That user does not exist',
                    },
                ],
            };
        }
        if (!(await argon2_1.default.verify(user.password, password))) {
            return {
                errors: [
                    {
                        field: 'password',
                        message: 'Incorrect password',
                    },
                ],
            };
        }
        req.session.userId = user.id;
        return {
            user,
        };
    }
    logout({ req, res }) {
        return new Promise(resolve => req.session.destroy(err => {
            res.clearCookie(constants_1.COOKIE_NAME);
            if (err) {
                console.log(err);
                resolve(false);
                return;
            }
            resolve(true);
        }));
    }
    async forgotPassword(email, { prisma, redisClient }) {
        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });
        if (!user) {
            return true;
        }
        const token = (0, uuid_1.v4)();
        await redisClient.set(constants_1.FORGET_PASSWORD_PREFIX + token, user.id, 'EX', 1000 * 60 * 60 * 24 * 3);
        const html = `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`;
        await (0, sendEmail_1.sendEmail)(user.email, html);
        return true;
    }
    async changePassword(token, newPassword, { prisma, redisClient, req }) {
        if (newPassword.length <= 2) {
            return {
                errors: [
                    {
                        field: 'newPassword',
                        message: 'Password must be greater than 2',
                    },
                ],
            };
        }
        const key = constants_1.FORGET_PASSWORD_PREFIX + token;
        const userId = await redisClient.get(key);
        if (!userId) {
            return {
                errors: [
                    {
                        field: 'token',
                        message: 'Token expired',
                    },
                ],
            };
        }
        const user = await prisma.user.findUnique({
            where: {
                id: parseInt(userId),
            },
        });
        if (!user) {
            return {
                errors: [
                    {
                        field: 'token',
                        message: 'User no longer exists',
                    },
                ],
            };
        }
        await prisma.user.update({
            where: {
                id: parseInt(userId),
            },
            data: {
                password: await argon2_1.default.hash(newPassword),
            },
        });
        await redisClient.del(key);
        req.session.userId = user.id;
        return {
            user,
        };
    }
};
__decorate([
    (0, type_graphql_1.Query)(() => UserType, { nullable: true }),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "me", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('options')),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UsernamePasswordInput_1.UsernamePasswordInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "register", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('usernameOrEmail')),
    __param(1, (0, type_graphql_1.Arg)('password')),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "login", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserResolver.prototype, "logout", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    __param(0, (0, type_graphql_1.Arg)('email')),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "forgotPassword", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('token')),
    __param(1, (0, type_graphql_1.Arg)('newPassword')),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "changePassword", null);
UserResolver = __decorate([
    (0, type_graphql_1.Resolver)()
], UserResolver);
exports.UserResolver = UserResolver;
//# sourceMappingURL=user.js.map
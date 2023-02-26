"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRegister = void 0;
const validateRegister = (options) => {
    if (options.username.length <= 2) {
        return [
            {
                field: 'username',
                message: 'Username must be at least 3 characters long',
            },
        ];
    }
    if (options.username.includes('@')) {
        return [
            {
                field: 'username',
                message: 'Username cannot include @',
            },
        ];
    }
    if (!options.email.includes('@')) {
        return [
            {
                field: 'email',
                message: 'Invalid email',
            },
        ];
    }
    if (options.password.length <= 2) {
        return [
            {
                field: 'password',
                message: 'Password must be at least 2 characters long',
            },
        ];
    }
    return null;
};
exports.validateRegister = validateRegister;
//# sourceMappingURL=validateRegister.js.map
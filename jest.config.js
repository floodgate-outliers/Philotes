module.exports = {
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            tsconfig: './tsconfig.json',
        },
    },
    globalSetup: './globalSetup.ts',
}

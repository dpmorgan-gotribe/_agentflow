/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@aigentflow/config/eslint/base'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '.turbo',
    'coverage',
    '*.config.js',
    '*.config.mjs',
  ],
};

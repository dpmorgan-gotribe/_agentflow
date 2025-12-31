/** @type {import('eslint').Linter.Config} */
const baseConfig = require('@aigentflow/config/eslint/base.js');

module.exports = {
  ...baseConfig,
  root: true,
  parserOptions: {
    ...baseConfig.parserOptions,
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['drizzle.config.ts'],
};

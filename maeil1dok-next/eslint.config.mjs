// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import tsParser from '@typescript-eslint/parser'

export default [{
  ignores: ['.next/**', 'node_modules/**', 'dist/**', '.git/**'],
}, {
  files: ['src/**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  rules: {},
}, ...storybook.configs["flat/recommended"]];

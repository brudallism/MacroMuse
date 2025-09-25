// eslint.config.js - Mandatory architectural rules from Foundation document
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactNative from 'eslint-plugin-react-native'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'

export default [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      '*.js.map',
      '*.d.ts',
      'coverage/**',
      'legacy code/**',
      'app/data/migrations/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        __DEV__: 'readonly',
        React: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        performance: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-native': reactNative,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // MANDATORY: Prevent cross-store imports (build must fail on violation)
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../state/*', '../../state/*', '../../../state/*'],
            message: '❌ ARCHITECTURAL VIOLATION: Use eventBus for cross-store communication. Stores cannot import other stores.',
          },
          {
            group: ['**/domain/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import domain directly - use facades in app/ layer',
          },
          {
            group: ['../app/*', '../../app/*'],
            message: '❌ ARCHITECTURAL VIOLATION: Domain layer cannot import from app layer',
          },
          {
            group: ['**/infra/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import infra directly - use facades',
          },
        ],
      }],

      // MANDATORY: Max 400 lines per file (build fails on violation)
      'max-lines': ['error', {
        max: 400,
        skipBlankLines: true,
        skipComments: true,
      }],

      // MANDATORY: Max cyclomatic complexity of 10
      complexity: ['error', { max: 10 }],

      // TypeScript strict enforcement
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // React/React Native rules
      'react/prop-types': 'off', // We use TypeScript
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',

      // Import organization
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        pathGroups: [
          {
            pattern: '@app/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@ui/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@domain/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@infra/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@data/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@state/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@lib/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@tests/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
      }],
    },
  },
  // Domain layer restrictions
  {
    files: ['app/domain/**/*.ts', 'app/domain/**/*.tsx'],
    rules: {
      // Domain layer is pure - no React imports allowed
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['react', 'react-native', 'expo*'],
            message: '❌ ARCHITECTURAL VIOLATION: Domain layer must be pure TypeScript - no React/React Native/Expo imports',
          },
          {
            group: ['../app/*', '../../app/*', '../ui/*', '../../ui/*'],
            message: '❌ ARCHITECTURAL VIOLATION: Domain cannot import from app or ui layers',
          },
        ],
      }],
    },
  },
  // UI layer restrictions
  {
    files: ['app/ui/**/*.ts', 'app/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../domain/**', '../../domain/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import domain directly - use facades',
          },
          {
            group: ['../infra/**', '../../infra/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import infra directly - use facades',
          },
        ],
      }],
    },
  },
  // Test files
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Logging and infrastructure files - allow console
  {
    files: ['app/lib/logger.ts', 'app/lib/sentry.ts', 'app/lib/eventBus.ts', 'app/lib/supabase*.ts', 'app/components/Test*.tsx'],
    rules: {
      'no-console': 'off',
      complexity: ['error', { max: 15 }], // Allow higher complexity for logging
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for generic infrastructure
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-useless-catch': 'off',
    },
  },
  // Service interfaces - allow unused parameters
  {
    files: ['app/domain/services/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Store files - allow unused parameters in interfaces
  {
    files: ['app/state/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
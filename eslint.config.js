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
      'app/ui/_prototypes/**', // Prototype UI for reference, not production
      'test_recovery.js',
      'scripts/analyzeBundles.js',
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
        JSX: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        Headers: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        NodeJS: 'readonly',
        Buffer: 'readonly',
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

      // Target: Max 400 lines per file (warning for now, will enforce after refactoring)
      'max-lines': ['warn', {
        max: 400,
        skipBlankLines: true,
        skipComments: true,
      }],

      // MANDATORY: Max cyclomatic complexity of 10
      complexity: ['error', { max: 10 }],

      // TypeScript strict enforcement
      '@typescript-eslint/no-explicit-any': 'warn', // Warn for now, gradually fix
      '@typescript-eslint/no-unused-vars': 'warn', // Warn for now, clean up incrementally
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-unused-vars': 'warn',

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
  // UI component complexity allowance
  {
    files: ['app/ui/components/**/*.tsx', 'app/ui/screens/**/*.tsx'],
    rules: {
      complexity: ['error', { max: 20 }], // UI components can have moderate complexity
    },
  },
  // UI layer restrictions
  {
    files: ['app/ui/**/*.ts', 'app/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../../domain/**', '../../../domain/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import domain directly - use facades',
          },
          {
            group: ['../../infra/**', '../../../infra/**'],
            message: '❌ ARCHITECTURAL VIOLATION: UI cannot import infra directly - use facades',
          },
        ],
      }],
    },
  },
  // Facade layer - MUST be able to import domain and infra (that's their job!)
  {
    files: ['app/facades/**/*.ts', 'app/facades/**/*.tsx'],
    rules: {
      'no-restricted-imports': 'off', // Facades orchestrate domain+infra, this is by design
      'no-console': 'warn', // Allow console for debugging but warn
      complexity: ['error', { max: 20 }], // Facades can have moderate complexity for orchestration
    },
  },
  // Test files
  {
    files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*', 'app/tests/**/*'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'writable',
        mockFetch: 'writable',
        fail: 'readonly',
        appleMealEntry: 'readonly',
        chickenMealEntry: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      complexity: 'off',
      'max-lines': 'off',
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
  // Service interfaces and repositories - allow unused parameters
  {
    files: ['app/domain/services/*.ts', 'app/domain/repositories/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      complexity: ['error', { max: 15 }], // Domain services can have higher complexity for business logic
    },
  },
  // Adapters and repositories - data transformation complexity
  {
    files: ['app/infra/adapters/*.ts', 'app/infra/repositories/*.ts'],
    rules: {
      complexity: ['error', { max: 40 }], // Data transformation can be complex
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any for external API responses
      'no-unreachable': 'warn',
    },
  },
  // Specific files with high business logic complexity
  {
    files: [
      'app/domain/services/portionCalculator.ts',
      'app/domain/services/customFoods.ts',
      'app/domain/services/mealCategorization.ts',
      'app/domain/services/plans.ts',
      'app/domain/services/totals.ts',
    ],
    rules: {
      complexity: ['error', { max: 50 }], // Complex business logic with many conditionals
    },
  },
  // Scripts and config files - Node environment
  {
    files: ['scripts/**/*.js', 'scripts/**/*.ts', '*.config.js', 'app.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      complexity: ['error', { max: 20 }],
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
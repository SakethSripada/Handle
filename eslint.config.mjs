import parser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'work/**',
            '.data/**',
            'spacetimedb/node_modules/**',
            'spacetimedb/dist/**',
        ],
    },
    {
        files: ['**/*.{ts,tsx,mjs}'],
        languageOptions: { parser },
        plugins: { '@stylistic': stylistic },
        rules: {
            curly: ['error', 'all'],
            '@stylistic/brace-style': [
                'error',
                '1tbs',
                { allowSingleLine: false },
            ],
            'one-var': ['error', 'never'],
            '@stylistic/max-statements-per-line': ['error', { max: 1 }],
            '@stylistic/lines-between-class-members': [
                'error',
                'always',
                { exceptAfterSingleLine: true },
            ],
            '@stylistic/padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: '*',
                    next: ['const', 'let', 'var'],
                },
                {
                    blankLine: 'always',
                    prev: ['const', 'let', 'var'],
                    next: '*',
                },
                {
                    blankLine: 'any',
                    prev: ['const', 'let', 'var'],
                    next: ['const', 'let', 'var'],
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: [
                        'return',
                        'if',
                        'for',
                        'while',
                        'switch',
                        'try',
                        'function',
                        'class',
                        'export',
                    ],
                },
                {
                    blankLine: 'always',
                    prev: ['block-like', 'export'],
                    next: '*',
                },
                { blankLine: 'always', prev: 'import', next: '*' },
                { blankLine: 'never', prev: 'import', next: 'import' },
            ],
        },
    },
];

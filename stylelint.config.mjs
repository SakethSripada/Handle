export default {
    ignoreFiles: ['node_modules/**', 'dist/**', 'work/**'],
    rules: {
        'rule-empty-line-before': [
            'always-multi-line',
            { except: ['first-nested'] },
        ],
        'at-rule-empty-line-before': ['always', { except: ['first-nested'] }],
    },
};

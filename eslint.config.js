import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'dev-dist/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];

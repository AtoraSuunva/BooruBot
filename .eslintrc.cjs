module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // Re-enable once fixed
    'import/no-unresolved': 'off',
    // Too many false-positive
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/no-base-to-string': [
      'warn',
      {
        // eslint warns "may evaluate to '[object Object]' when stringified" for this, although they
        // actually provide useful string representations
        // The types *do* resolve `NewsChannel['toString']` to `(() => string) & (() => ChannelMention)`
        // which is *weird*, I can't directly tell why (look into this later?)
        ignoredTypeNames: [
          'PartialDMChannel',
          'NewsChannel',
          'StageChannel',
          'TextChannel',
          'VoiceChannel',
        ],
      },
    ],
  },
}

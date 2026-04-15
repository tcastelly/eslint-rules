export default {
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'variable',
      format: null,
      custom: {
        regex: '^(_?[a-zA-Z0-9]*)|([A-Z0-9_])$',
        match: true,
      },
    },
  ],
}

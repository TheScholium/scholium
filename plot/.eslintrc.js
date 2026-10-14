module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // e-ink layouts are tuned inline; one-line guards read better without braces
    curly: 'off',
    'react-native/no-inline-styles': 'off',
  },
};

module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/navigation': './src/navigation',
            '@/services': './src/services',
            '@/stores': './src/stores',
            '@/utils': './src/utils',
            '@/types': './src/types',
            '@/hooks': './src/hooks',
            '@/constants': './src/constants',
          },
        },
      ],
    ],
  };
};

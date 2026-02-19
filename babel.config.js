module.exports = function (api) {
  api.cache(true);

  const plugins = [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@": "./client",
          "@shared": "./shared",
        },
        extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
      },
    ],
    "react-native-reanimated/plugin",
  ];

  // 프로덕션 빌드에서 console.* 자동 제거
  if (process.env.NODE_ENV === "production") {
    plugins.unshift("transform-remove-console");
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};

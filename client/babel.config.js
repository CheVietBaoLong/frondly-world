module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // WatermelonDB models use legacy decorators (@field, @children, ...).
    // Pinned to the v7 decorators plugin to match Expo's Babel 7 toolchain.
    plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
  };
};

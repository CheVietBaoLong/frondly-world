module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // WatermelonDB models use legacy decorators (@field, @children, ...)
    plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
  };
};

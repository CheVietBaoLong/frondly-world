module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // WatermelonDB models use legacy decorators (@field, @children, ...).
    // plugin-proposal-decorators v8 renamed `legacy: true` → `version: "legacy"`.
    plugins: [["@babel/plugin-proposal-decorators", { version: "legacy" }]],
  };
};

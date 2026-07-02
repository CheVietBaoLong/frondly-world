module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // WatermelonDB models (src/db) use legacy decorators (@field, @children, ...).
    // Pinned to the v7 decorators plugin to match Expo's Babel 7 toolchain.
    //
    // On RN 0.85/Hermes, babel-preset-expo skips the class-properties transform
    // (Hermes supports class fields natively), but legacy decorators REQUIRE
    // class-properties to run *after* them — otherwise WatermelonDB models throw
    // "Decorating class property failed" at runtime. Applying loose class-properties
    // globally breaks libraries that depend on spec-mode class fields (e.g.
    // "Cannot assign to read-only property 'NONE'"), so we scope these transforms
    // to the model files only. The three loose flags must match (Babel consistency).
    overrides: [
      {
        // Function test (not a RegExp): Metro's cache-key step calls Babel with
        // no filename, and a string/RegExp `test` throws there. A function can
        // safely return false when filename is undefined.
        test: (filename) => !!filename && /[\\/]src[\\/]db[\\/]/.test(filename),
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-transform-class-properties", { loose: true }],
          ["@babel/plugin-transform-private-methods", { loose: true }],
          ["@babel/plugin-transform-private-property-in-object", { loose: true }],
        ],
      },
    ],
  };
};

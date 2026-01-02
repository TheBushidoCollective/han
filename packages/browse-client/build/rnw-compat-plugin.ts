/**
 * Bun plugin to fix CommonJS/ESM interop issues with inline-style-prefixer
 * and css-in-js-utils packages.
 *
 * The problem: Bun's __toESM wrapper with isNodeMode=1 creates a default export
 * that wraps the entire module object instead of the actual default export.
 *
 * Solution: Transform imports from /lib/ paths to /es/ paths to use the
 * proper ESM versions that don't have this issue.
 */

import { readFileSync } from 'node:fs';
import type { BunPlugin } from 'bun';

export function rnwCompatPlugin(): BunPlugin {
  return {
    name: 'rnw-compat',
    setup(build) {
      // Transform files that import from inline-style-prefixer/lib or css-in-js-utils/lib
      // This includes react-native-web's prefixStyles and inline-style-prefixer's own plugins
      build.onLoad(
        { filter: /(prefixStyles|inline-style-prefixer.*plugins).*\.js$/ },
        async (args) => {
          let contents = readFileSync(args.path, 'utf-8');

          // Replace inline-style-prefixer/lib with inline-style-prefixer/es
          contents = contents.replace(
            /(['"])inline-style-prefixer\/lib\//g,
            '$1inline-style-prefixer/es/'
          );

          // Replace css-in-js-utils/lib with css-in-js-utils/es
          contents = contents.replace(
            /(['"])css-in-js-utils\/lib\//g,
            '$1css-in-js-utils/es/'
          );

          return {
            contents,
            loader: 'js',
          };
        }
      );
    },
  };
}

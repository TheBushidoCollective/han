/**
 * Bun plugin for react-native-web compatibility.
 *
 * Handles two issues:
 * 1. Aliases 'react-native' imports to 'react-native-web'
 * 2. Fixes CommonJS/ESM interop issues with inline-style-prefixer/css-in-js-utils
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BunPlugin } from 'bun';

export function rnwCompatPlugin(): BunPlugin {
  return {
    name: 'rnw-compat',
    setup(build) {
      // Alias 'react-native' to 'react-native-web'
      // This is needed for libraries like @shopify/flash-list that import from react-native
      build.onResolve({ filter: /^react-native$/ }, () => {
        // Resolve react-native-web from browse-client's node_modules
        // import.meta.dir = build/
        // Parent = browse-client/
        const browseClientRoot = dirname(import.meta.dir);
        return {
          path: join(
            browseClientRoot,
            'node_modules/react-native-web/dist/index.js'
          ),
        };
      });

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

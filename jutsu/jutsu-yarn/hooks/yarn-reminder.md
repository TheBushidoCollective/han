# Yarn Package Manager

This project uses **Yarn**, not npm. Always use Yarn commands:

| Instead of | Use |
|------------|-----|
| `npm install` | `yarn` or `yarn install` |
| `npm install <pkg>` | `yarn add <pkg>` |
| `npm install -D <pkg>` | `yarn add -D <pkg>` |
| `npm uninstall <pkg>` | `yarn remove <pkg>` |
| `npm run <script>` | `yarn <script>` |
| `npm test` | `yarn test` |
| `npm ci` | `yarn install --frozen-lockfile` |

Do not use `npm` commands as they will create a `package-lock.json` file that conflicts with `yarn.lock`.

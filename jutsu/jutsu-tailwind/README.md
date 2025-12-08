# Jutsu: Tailwind CSS

Validation and quality enforcement for Tailwind CSS projects with comprehensive utility-first CSS patterns and best practices.

## What This Jutsu Provides

### Validation Hooks

- **Tailwind Build Validation**: Automatically validates your Tailwind CSS build process to ensure all classes are properly compiled and no errors are present
- **CSS Generation Check**: Verifies that Tailwind generates valid CSS output with proper minification
- **Configuration Validation**: Ensures your `tailwind.config.js` is properly configured

The validation hook runs automatically when you finish a conversation with Claude Code or when agents complete their work.

### Skills

This jutsu provides comprehensive skills for working with Tailwind CSS:

- **tailwind-utility-classes**: Master Tailwind's utility-first approach with utilities for layout, spacing, typography, colors, and effects
- **tailwind-configuration**: Set up and customize Tailwind config, theme extensions, plugins, and build configuration
- **tailwind-components**: Build reusable component patterns using CVA, compound components, and best practices
- **tailwind-responsive-design**: Create mobile-first responsive layouts with breakpoints and adaptive design
- **tailwind-performance**: Optimize Tailwind for production with JIT mode, content configuration, and bundle optimization

## Installation

### Via Han Marketplace

```bash
han plugin install jutsu-tailwind
```

### Via Claude Code

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-tailwind@han
```

### Manual Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/thebushidocollective/han.git
   ```

2. Install the plugin:

   ```bash
   claude plugin install /path/to/han/jutsu/jutsu-tailwind@local
   ```

## Usage

Once installed, this jutsu automatically validates your Tailwind CSS code:

- **On Conversation Stop**: When you finish a conversation with Claude Code
- **On Agent Completion**: When Claude Code agents complete their work
- **Cached Validation**: Smart caching ensures validation only runs when relevant files change

### What Gets Validated

The validation hook checks:

1. **Tailwind Build**: Runs `tailwindcss` to compile your CSS
2. **Configuration Files**: Validates `tailwind.config.{js,ts,cjs,mjs}`
3. **Template Files**: Monitors changes to HTML, JSX, TSX, Vue, and Svelte files
4. **CSS Files**: Tracks changes to your CSS source files

### Customizing Validation

You can customize the validation behavior by modifying `han-config.json`:

```json
{
  "hooks": {
    "build": {
      "command": "npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify",
      "dirsWith": ["tailwind.config.js", "tailwind.config.ts"],
      "ifChanged": ["**/*.{html,js,jsx,ts,tsx,vue,svelte}", "**/*.css"]
    }
  }
}
```

### Disabling Validation

To temporarily disable validation:

```bash
# Disable all Han hooks globally
export HAN_DISABLE_HOOKS=true
```

Or remove the jutsu from your Claude Code settings.

## Requirements

- **Tailwind CSS**: 3.0 or higher recommended
- **Node.js**: 16.x or higher
- **Build Tool**: Vite, Next.js, Webpack, or similar (for production builds)

### Recommended Setup

For the best experience, ensure your project has:

1. A `tailwind.config.js` (or `.ts`, `.cjs`, `.mjs`) file
2. A PostCSS configuration (`postcss.config.js`)
3. Content paths properly configured in your Tailwind config
4. Tailwind CSS installed as a dependency

Example `package.json`:

```json
{
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

## Configuration Examples

### Vite + React

```javascript
// tailwind.config.js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Next.js

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Vue 3

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Troubleshooting

### "No utility classes were detected"

This usually means your content paths in `tailwind.config.js` aren't configured correctly. Ensure your content array includes all files that use Tailwind classes:

```javascript
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Include all source files
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
}
```

### "Command not found: tailwindcss"

Install Tailwind CSS in your project:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

### Validation Hook Times Out

If your Tailwind build is slow, you can adjust the timeout in `hooks/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @thebushidocollective/han hook run jutsu-tailwind build --fail-fast --cached",
            "timeout": 300000
          }
        ]
      }
    ]
  }
}
```

## Best Practices

When working with this jutsu:

1. **Keep Config Simple**: Start with a minimal configuration and extend as needed
2. **Use JIT Mode**: Tailwind 3.0+ uses JIT by default for better performance
3. **Optimize Content Paths**: Be specific in your content configuration to avoid scanning unnecessary files
4. **Use Utilities First**: Prefer utility classes over custom CSS
5. **Extract Components Wisely**: Use component abstraction for repeated patterns, not `@apply` everywhere

## Related Plugins

Enhance your Tailwind workflow with these complementary plugins:

- **jutsu-typescript**: Type-checking for TypeScript projects using Tailwind
- **jutsu-prettier**: Code formatting for consistent style
- **jutsu-biome**: Alternative linting and formatting with Biome
- **do-frontend-development**: Specialized agents for frontend development

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS GitHub](https://github.com/tailwindlabs/tailwindcss)
- [Tailwind UI Components](https://tailwindui.com/)
- [Tailwind Play](https://play.tailwindcss.com/) - Online playground

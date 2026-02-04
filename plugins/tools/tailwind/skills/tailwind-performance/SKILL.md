---
name: tailwind-performance
description: Use when optimizing Tailwind CSS for production, reducing bundle size, and improving performance. Covers PurgeCSS, JIT mode, and build optimization.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Tailwind CSS - Performance Optimization

Tailwind CSS includes powerful tools for optimizing your CSS for production, ensuring fast load times and minimal bundle sizes.

## Key Concepts

### Just-In-Time (JIT) Mode

JIT mode (default since Tailwind 3.0) generates styles on-demand as you author your templates:

**Benefits:**

- Lightning-fast build times
- All variants enabled by default
- Arbitrary value support
- Smaller development builds
- No separate production build needed

```javascript
// tailwind.config.js (JIT is default, no config needed)
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  // JIT mode is automatic
}
```

### Content Configuration

Proper content paths are critical for performance:

```javascript
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    // Include any files that contain Tailwind classes
    './public/index.html',
  ],
}
```

## Best Practices

### 1. Optimize Content Paths

Be specific to avoid scanning unnecessary files:

```javascript
// Good: Specific paths
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
}

// Bad: Too broad
module.exports = {
  content: [
    './**/*.{js,jsx,ts,tsx}', // Scans node_modules!
  ],
}
```

### 2. Use Safelist for Dynamic Classes

When class names are constructed dynamically, use safelist:

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  safelist: [
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    // Or use patterns
    {
      pattern: /bg-(red|green|blue)-(400|500|600)/,
      variants: ['hover', 'focus'],
    },
  ],
}
```

### 3. Avoid String Concatenation

Don't construct class names dynamically:

```jsx
// Bad: These classes won't be detected
<div className={`text-${size}`}>
<div className={`bg-${color}-500`}>

// Good: Use complete class names
<div className={size === 'large' ? 'text-lg' : 'text-sm'}>
<div className={color === 'red' ? 'bg-red-500' : 'bg-blue-500'}>

// Or use safelist for dynamic values
```

### 4. Minimize Custom CSS

Rely on utilities to reduce overall CSS size:

```css
/* Bad: Custom CSS that duplicates utilities */
.my-button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

/* Good: Use utilities or @apply */
@layer components {
  .my-button {
    @apply bg-blue-500 text-white px-4 py-2 rounded-md;
  }
}

/* Better: Component abstraction (no custom CSS) */
```

### 5. Enable CSS Minification

Ensure your build process minifies CSS:

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  },
}
```

### 6. Use CSS Variables Strategically

Combine Tailwind with CSS variables for theme switching without bloat:

```css
:root {
  --color-primary: 59 130 246; /* RGB */
}

[data-theme='dark'] {
  --color-primary: 96 165 250;
}
```

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
      },
    },
  },
}
```

## Build Optimization

### Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    cssMinify: 'esbuild', // Fast CSS minification
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
```

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true, // Enable CSS optimization
  },
  // Next.js automatically optimizes Tailwind
}
```

### Webpack Configuration

```javascript
// webpack.config.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')

module.exports = {
  optimization: {
    minimizer: [
      new CssMinimizerPlugin(),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),
  ],
}
```

## Performance Patterns

### 1. Code Splitting

Split CSS by route or component:

```javascript
// Using dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Tailwind classes in HeavyComponent will be in a separate chunk
```

### 2. Critical CSS

Extract critical CSS for above-the-fold content:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Inline critical CSS */
    .hero { /* ... */ }
    .nav { /* ... */ }
  </style>
  <!-- Load full CSS async -->
  <link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles.css"></noscript>
</head>
```

### 3. Lazy Load Non-Critical Styles

```javascript
// Load additional styles when needed
if (shouldLoadDarkMode) {
  import('./dark-mode.css')
}
```

### 4. Font Optimization

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter var',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
}
```

```css
/* Use font-display for better loading */
@font-face {
  font-family: 'Inter var';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap; /* Prevent invisible text */
  src: url('/fonts/inter-var.woff2') format('woff2');
}
```

## Monitoring Performance

### Bundle Size Analysis

```bash
# Analyze CSS bundle size
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify

# Check file size
ls -lh dist/output.css

# Detailed analysis with webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
```

### Lighthouse Metrics

Target metrics:

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **CSS Bundle Size**: < 50KB (gzipped)

### Performance Checklist

```markdown
✅ Content paths are specific and optimized
✅ JIT mode is enabled (default in Tailwind 3+)
✅ CSS is minified in production
✅ Unused styles are purged
✅ Dynamic classes use safelist
✅ Critical CSS is inlined
✅ Fonts use font-display: swap
✅ CSS is code-split by route/chunk
✅ Gzip/Brotli compression enabled
✅ CSS file has content hash for caching
```

## Examples

### Production Build Script

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:css": "tailwindcss -i ./src/input.css -o ./dist/output.css --minify",
    "analyze": "npm run build && webpack-bundle-analyzer dist/stats.json"
  }
}
```

### Optimized Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: {
    files: [
      './src/**/*.{js,jsx,ts,tsx}',
      './components/**/*.{js,jsx,ts,tsx}',
    ],
    // Only in dev: watch for changes
    relative: process.env.NODE_ENV === 'development',
  },
  theme: {
    extend: {
      // Only extend what you need
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
      },
    },
  },
  plugins: [
    // Only include plugins you use
    require('@tailwindcss/forms'),
  ],
  // Disable unused variants
  corePlugins: {
    // Disable unused features
    preflight: true,
    // Only enable what you need
  },
}
```

### CDN vs Bundle Comparison

```html
<!-- Bad: CDN (3.5MB+, not optimized) -->
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet">

<!-- Good: Bundled & optimized (typically 5-20KB gzipped) -->
<link href="/dist/styles.css" rel="stylesheet">
```

## Common Pitfalls

### ❌ Using CDN in Production

```html
<!-- Never do this in production -->
<script src="https://cdn.tailwindcss.com"></script>
```

The CDN build is 3.5MB+ and includes all utilities. Always use a build process.

### ❌ Overly Broad Content Paths

```javascript
// Bad: Scans everything including node_modules
content: ['./**/*.html']

// Good: Specific to your source files
content: ['./src/**/*.{html,js,jsx,ts,tsx}']
```

### ❌ Not Using Safelist for Dynamic Classes

```jsx
// Bad: Class won't be included in build
const colors = ['red', 'blue', 'green']
<div className={`bg-${colors[index]}-500`} />

// Good: Use safelist or conditional classes
```

### ❌ Importing Full Tailwind in Components

```javascript
// Bad: Imports all of Tailwind
import 'tailwindcss/tailwind.css'

// Good: Import only what you built
import './styles.css'
```

## Anti-Patterns

### ❌ Don't Disable Purge in Production

```javascript
// Bad: Never do this
module.exports = {
  content: [], // Empty = no purging!
}
```

### ❌ Don't Use @apply Excessively

```css
/* Bad: Defeating the purpose of utilities */
.btn { @apply px-4 py-2 bg-blue-500 text-white rounded; }
.card { @apply p-6 bg-white shadow-lg rounded-lg; }
.header { @apply flex items-center justify-between p-4; }
/* ...hundreds of components */

/* This negates Tailwind's optimization benefits */
```

### ❌ Don't Ignore Build Warnings

```bash
# Pay attention to warnings like:
# "The content option in your Tailwind CSS configuration is missing or empty"
# "No utility classes were detected in your source files"
```

## Related Skills

- **tailwind-configuration**: Customizing Tailwind config and theme
- **tailwind-utility-classes**: Using Tailwind's utility classes effectively
- **tailwind-responsive-design**: Building responsive designs efficiently

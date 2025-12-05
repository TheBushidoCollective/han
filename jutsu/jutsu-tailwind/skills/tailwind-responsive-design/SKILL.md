---
name: tailwind-responsive-design
description: Use when building responsive layouts and mobile-first designs with Tailwind CSS. Covers breakpoints, container queries, and responsive utilities.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Tailwind CSS - Responsive Design

Tailwind CSS provides a mobile-first responsive design system using breakpoint prefixes that make it easy to build adaptive layouts.

## Key Concepts

### Mobile-First Approach

Tailwind uses a mobile-first breakpoint system. Unprefixed utilities apply to all screen sizes, and breakpoint prefixes apply from that breakpoint and up:

```html
<!-- Mobile: full width, Tablet+: half width, Desktop+: third width -->
<div class="w-full md:w-1/2 lg:w-1/3">
  Responsive width
</div>
```

### Default Breakpoints

```javascript
// tailwind.config.js default breakpoints
{
  sm: '640px',   // Small devices (landscape phones)
  md: '768px',   // Medium devices (tablets)
  lg: '1024px',  // Large devices (desktops)
  xl: '1280px',  // Extra large devices (large desktops)
  '2xl': '1536px' // 2X large devices (larger desktops)
}
```

## Best Practices

### 1. Start Mobile, Scale Up

Design for mobile first, then add complexity for larger screens:

```html
<!-- Good: Mobile-first approach -->
<div class="
  flex flex-col
  md:flex-row
  gap-4
">
  <div class="w-full md:w-1/2">Column 1</div>
  <div class="w-full md:w-1/2">Column 2</div>
</div>

<!-- Bad: Desktop-first (requires more overrides) -->
<div class="
  flex flex-row
  sm:flex-col
">
```

### 2. Use Responsive Typography

Scale text appropriately across devices:

```html
<h1 class="
  text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl
  font-bold
  leading-tight
">
  Responsive Heading
</h1>

<p class="
  text-sm sm:text-base md:text-lg
  leading-relaxed
">
  Body text that scales
</p>
```

### 3. Responsive Spacing

Adjust padding and margins for different screens:

```html
<div class="
  px-4 sm:px-6 md:px-8 lg:px-12
  py-8 md:py-12 lg:py-16
">
  <!-- Content with responsive padding -->
</div>

<section class="
  space-y-4 md:space-y-6 lg:space-y-8
">
  <!-- Responsive spacing between children -->
</section>
```

### 4. Grid Layouts

Create responsive grids that adapt to screen size:

```html
<!-- 1 column mobile, 2 tablet, 3 desktop, 4 large desktop -->
<div class="
  grid
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
  gap-4 md:gap-6
">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>
```

### 5. Show/Hide Elements

Control visibility across breakpoints:

```html
<!-- Mobile menu button: visible on mobile, hidden on desktop -->
<button class="md:hidden">
  <svg><!-- Menu icon --></svg>
</button>

<!-- Desktop navigation: hidden on mobile, visible on desktop -->
<nav class="hidden md:flex space-x-6">
  <a href="#">Home</a>
  <a href="#">About</a>
  <a href="#">Contact</a>
</nav>

<!-- Show only on mobile -->
<div class="block md:hidden">Mobile only</div>

<!-- Show only on desktop -->
<div class="hidden lg:block">Desktop only</div>
```

## Examples

### Responsive Hero Section

```html
<section class="
  relative
  min-h-screen md:min-h-[600px] lg:min-h-[800px]
  px-4 sm:px-6 lg:px-8
  py-12 md:py-16 lg:py-20
">
  <div class="
    max-w-7xl mx-auto
    flex flex-col md:flex-row
    items-center
    gap-8 md:gap-12
  ">
    <!-- Text Content -->
    <div class="
      w-full md:w-1/2
      text-center md:text-left
    ">
      <h1 class="
        text-3xl sm:text-4xl md:text-5xl lg:text-6xl
        font-bold
        mb-4 md:mb-6
      ">
        Welcome to Our Site
      </h1>
      <p class="
        text-base sm:text-lg md:text-xl
        text-gray-600
        mb-6 md:mb-8
      ">
        This is a responsive hero section that adapts to all screen sizes.
      </p>
      <button class="
        w-full sm:w-auto
        px-6 md:px-8
        py-3 md:py-4
        bg-blue-500 hover:bg-blue-600
        text-white
        text-base md:text-lg
        rounded-lg
      ">
        Get Started
      </button>
    </div>

    <!-- Image -->
    <div class="
      w-full md:w-1/2
      order-first md:order-last
    ">
      <img
        src="/hero.jpg"
        alt="Hero"
        class="
          w-full
          rounded-lg md:rounded-xl
          shadow-lg md:shadow-2xl
        "
      />
    </div>
  </div>
</section>
```

### Responsive Card Grid

```html
<div class="
  grid
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
  gap-4 sm:gap-6 lg:gap-8
  px-4 sm:px-6 lg:px-8
">
  {cards.map(card => (
    <div class="
      bg-white
      rounded-lg md:rounded-xl
      shadow-md hover:shadow-xl
      overflow-hidden
      transition-shadow
    ">
      <img
        src={card.image}
        alt={card.title}
        class="
          w-full
          h-48 sm:h-56 lg:h-64
          object-cover
        "
      />
      <div class="
        p-4 sm:p-5 lg:p-6
      ">
        <h3 class="
          text-lg sm:text-xl
          font-semibold
          mb-2
        ">
          {card.title}
        </h3>
        <p class="
          text-sm sm:text-base
          text-gray-600
          line-clamp-3
        ">
          {card.description}
        </p>
      </div>
    </div>
  ))}
</div>
```

### Responsive Navigation

```html
<nav class="
  bg-white
  border-b border-gray-200
  sticky top-0 z-50
">
  <div class="
    max-w-7xl mx-auto
    px-4 sm:px-6 lg:px-8
  ">
    <div class="
      flex justify-between items-center
      h-16 md:h-20
    ">
      <!-- Logo -->
      <div class="flex-shrink-0">
        <img
          src="/logo.svg"
          alt="Logo"
          class="h-8 md:h-10 w-auto"
        />
      </div>

      <!-- Desktop Navigation -->
      <div class="
        hidden md:flex
        space-x-8
      ">
        <a href="#" class="
          text-gray-700 hover:text-blue-600
          px-3 py-2
          text-sm lg:text-base
          font-medium
        ">
          Home
        </a>
        <a href="#" class="
          text-gray-700 hover:text-blue-600
          px-3 py-2
          text-sm lg:text-base
          font-medium
        ">
          About
        </a>
        <a href="#" class="
          text-gray-700 hover:text-blue-600
          px-3 py-2
          text-sm lg:text-base
          font-medium
        ">
          Services
        </a>
        <a href="#" class="
          text-gray-700 hover:text-blue-600
          px-3 py-2
          text-sm lg:text-base
          font-medium
        ">
          Contact
        </a>
      </div>

      <!-- Mobile Menu Button -->
      <button class="
        md:hidden
        p-2
        rounded-md
        text-gray-700 hover:bg-gray-100
      ">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Mobile Menu -->
  <div class="md:hidden border-t border-gray-200">
    <div class="px-2 pt-2 pb-3 space-y-1">
      <a href="#" class="
        block px-3 py-2
        rounded-md
        text-base font-medium
        text-gray-700 hover:bg-gray-100
      ">
        Home
      </a>
      <a href="#" class="
        block px-3 py-2
        rounded-md
        text-base font-medium
        text-gray-700 hover:bg-gray-100
      ">
        About
      </a>
      <a href="#" class="
        block px-3 py-2
        rounded-md
        text-base font-medium
        text-gray-700 hover:bg-gray-100
      ">
        Services
      </a>
      <a href="#" class="
        block px-3 py-2
        rounded-md
        text-base font-medium
        text-gray-700 hover:bg-gray-100
      ">
        Contact
      </a>
    </div>
  </div>
</nav>
```

## Advanced Patterns

### Container Queries (Modern)

Use container queries for component-level responsiveness:

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
```

```html
<div class="@container">
  <div class="
    @sm:grid @sm:grid-cols-2
    @lg:grid-cols-3
    gap-4
  ">
    <!-- Responsive to container, not viewport -->
  </div>
</div>
```

### Custom Breakpoints

Add project-specific breakpoints:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
      // Max-width breakpoints
      'max-md': { 'max': '767px' },
      // Height breakpoints
      'tall': { 'raw': '(min-height: 800px)' },
    },
  },
}
```

### Orientation-Based Styles

```html
<div class="
  portrait:flex-col
  landscape:flex-row
">
  Content that adapts to orientation
</div>
```

### Print Styles

```html
<div class="
  text-base
  print:text-xs
  print:hidden
">
  This is hidden in print
</div>

<div class="hidden print:block">
  This only appears in print
</div>
```

## Common Patterns

### Responsive Image Sizes

```html
<img
  src="/image.jpg"
  alt="Responsive image"
  class="
    w-full
    h-auto
    max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl
    mx-auto
  "
/>

<!-- With aspect ratio -->
<div class="
  aspect-square sm:aspect-video
  w-full
  overflow-hidden
">
  <img
    src="/image.jpg"
    class="w-full h-full object-cover"
  />
</div>
```

### Responsive Flexbox Direction

```html
<div class="
  flex
  flex-col sm:flex-row
  gap-4
  items-center sm:items-start
  justify-center sm:justify-between
">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

### Responsive Order

```html
<div class="flex flex-col md:flex-row">
  <div class="order-2 md:order-1">First on desktop, second on mobile</div>
  <div class="order-1 md:order-2">Second on desktop, first on mobile</div>
</div>
```

## Anti-Patterns

### ❌ Don't Use Too Many Breakpoints

```html
<!-- Bad: Excessive breakpoints -->
<div class="
  text-xs
  sm:text-sm
  md:text-base
  lg:text-lg
  xl:text-xl
  2xl:text-2xl
">

<!-- Good: Strategic breakpoints -->
<div class="
  text-sm
  md:text-base
  lg:text-lg
">
```

### ❌ Don't Forget Mobile Users

```html
<!-- Bad: Desktop-only thinking -->
<div class="grid grid-cols-4 gap-2">

<!-- Good: Mobile-first -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### ❌ Don't Use Arbitrary Breakpoints Everywhere

```html
<!-- Bad: Too many custom breakpoints -->
<div class="min-[823px]:flex min-[1043px]:grid">

<!-- Good: Use standard breakpoints -->
<div class="md:flex lg:grid">
```

## Related Skills

- **tailwind-utility-classes**: Using Tailwind's utility classes effectively
- **tailwind-components**: Building reusable component patterns
- **tailwind-performance**: Optimizing responsive designs for performance

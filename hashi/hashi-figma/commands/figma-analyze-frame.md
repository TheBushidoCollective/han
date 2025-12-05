---
description: Analyze a Figma frame's structure, properties, and implementation considerations
---

# Analyze Figma Frame

You are tasked with analyzing a Figma frame to understand its structure, properties, and provide implementation guidance.

## Your Task

1. **Access the Frame**:
   - Use Figma MCP tools to access the specified frame
   - Accept either selection-based or link-based input
   - If neither provided, ask the user to select a frame or provide a URL

2. **Analyze Structure**:
   - Identify the frame hierarchy (parent-child relationships)
   - List all layers and their types (text, rectangle, group, component, etc.)
   - Note frame layout method (auto-layout, fixed, absolute positioning)
   - Identify any component instances used

3. **Analyze Styling**:
   - Extract colors (fills, strokes, shadows)
   - Note typography properties (font, size, weight, line height)
   - Identify spacing and sizing values
   - Check for design token usage
   - Note effects (shadows, blurs, etc.)

4. **Analyze Layout**:
   - Describe layout system (flexbox equivalent, grid, absolute)
   - Note responsive behavior (constraints, resizing rules)
   - Identify spacing patterns (padding, gaps, margins)
   - Check alignment and distribution

5. **Analyze Interactivity**:
   - Identify interactive elements (buttons, links, inputs)
   - Note any prototyping connections or interactions
   - Check for states (hover, active, disabled, etc.)
   - Identify any component variants for different states

6. **Implementation Analysis**:
   - Recommend HTML structure and semantic elements
   - Suggest CSS approach (flexbox, grid, custom properties)
   - Identify component breakdown opportunities
   - Note accessibility considerations
   - Recommend responsive strategy

## Report Format

Provide a comprehensive analysis report:

```markdown
# Figma Frame Analysis

Frame: [Frame name]
File: [Figma file name]
URL: [Figma URL]
Analyzed: [date]

## Overview

Brief description of the frame's purpose and content.

## Structure

### Hierarchy
```

Frame: [name] (Auto-layout, Vertical)
├─ Header (Auto-layout, Horizontal)
│  ├─ Logo (Component Instance)
│  └─ Navigation (Auto-layout, Horizontal)
│     ├─ NavItem (Component Instance) x4
│     └─ Button (Component Instance)
├─ MainContent (Auto-layout, Vertical)
│  ├─ Hero (Frame)
│  │  ├─ Title (Text)
│  │  └─ Subtitle (Text)
│  └─ Features (Auto-layout, Horizontal, wrap)
│     └─ FeatureCard (Component Instance) x6
└─ Footer (Auto-layout, Horizontal)

```

### Layout System
- **Type**: Auto-layout (Flexbox equivalent)
- **Direction**: Vertical
- **Spacing**: 24px gap between sections
- **Padding**: 64px horizontal, 32px vertical
- **Alignment**: Center-aligned content

## Styling

### Colors
- Background: #FFFFFF (--color-background)
- Primary: #3B82F6 (--color-primary)
- Text: #111827 (--color-text)
- Border: #E5E7EB (--color-border)

### Typography
- Heading: Inter 32px/40px, weight 700
- Body: Inter 16px/24px, weight 400
- Caption: Inter 14px/20px, weight 500

### Spacing
- Section gap: 24px
- Card gap: 16px
- Button padding: 12px 24px

### Effects
- Card shadow: 0px 4px 6px rgba(0, 0, 0, 0.1)
- Button hover: 0px 2px 4px rgba(0, 0, 0, 0.2)

## Components Used

1. **Button** (4 instances)
   - Variant: Primary (2), Secondary (2)
   - Size: Medium
   - Figma: [component URL]

2. **FeatureCard** (6 instances)
   - No variants
   - Figma: [component URL]

3. **NavItem** (4 instances)
   - State: Default (3), Active (1)
   - Figma: [component URL]

## Responsive Behavior

### Constraints
- Header: Fixed to top, stretches horizontally
- MainContent: Center-aligned, max-width 1200px
- Footer: Fixed to bottom, stretches horizontally

### Breakpoints Needed
- Desktop (1200px+): 6 feature cards in 3 columns
- Tablet (768px-1199px): 4 cards in 2 columns
- Mobile (<768px): Stack cards in 1 column

### Resizing Rules
- Text: Fixed size, wraps at small widths
- Images: Scale proportionally
- Containers: Flexible width with max-width

## Accessibility Considerations

### Semantic HTML
```html
<header>
  <nav>
    <a href="/" aria-label="Home">
      <img src="logo.svg" alt="Company Name" />
    </a>
    <ul role="list">
      <li><a href="/about">About</a></li>
      <!-- ... -->
    </ul>
  </nav>
</header>
<main>
  <section aria-labelledby="hero-title">
    <h1 id="hero-title">...</h1>
  </section>
  <section aria-labelledby="features-title">
    <h2 id="features-title">Features</h2>
    <div role="list">
      <!-- Feature cards -->
    </div>
  </section>
</main>
<footer>
  <!-- Footer content -->
</footer>
```

### ARIA Requirements

- Navigation landmarks
- Heading hierarchy (h1 → h2 → h3)
- Button labels and roles
- Image alt text
- Focus indicators

### Keyboard Navigation

- All interactive elements reachable via Tab
- Skip-to-content link
- Logical tab order
- Focus visible styles

## Implementation Recommendations

### Component Breakdown

Suggest creating these components:

1. `Header` - Top navigation bar
2. `Hero` - Hero section with title and CTA
3. `FeatureGrid` - Grid of feature cards
4. `FeatureCard` - Individual feature card
5. `Footer` - Footer section

### CSS Approach

```css
/* Use CSS Grid for feature layout */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

/* Use Flexbox for header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-xl);
}
```

### Responsive Strategy

- Mobile-first approach
- CSS Grid with auto-fit for feature cards
- Flexbox for header navigation
- Media queries at 768px and 1200px
- Fluid typography (clamp for heading sizes)

### Design Tokens

Reference these tokens (create if they don't exist):

- `--color-primary`, `--color-text`, `--color-background`
- `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`
- `--font-family-base`, `--font-size-body`, `--line-height-body`
- `--shadow-sm`, `--shadow-md`

## Potential Issues

1. **Performance**: 6 feature cards with images - consider lazy loading
2. **Accessibility**: Ensure sufficient color contrast (verify WCAG AA)
3. **Responsive**: Navigation may need hamburger menu on mobile
4. **Content**: Text lengths vary - ensure layout handles overflow

## Next Steps

1. Generate component code (use `/figma:generate-component`)
2. Extract design tokens (use `/figma:extract-tokens`)
3. Create responsive breakpoint tests
4. Implement accessibility features
5. Add loading states and error handling

```

## Best Practices

1. **Be Thorough**: Analyze every aspect of the frame
2. **Be Specific**: Include exact values, not approximations
3. **Be Actionable**: Provide concrete implementation guidance
4. **Be Accessible**: Always consider accessibility from the start
5. **Be Responsive**: Think mobile-first and adaptive layouts

## Additional Analysis

If the user requests, also analyze:

- **Performance**: Large images, heavy animations, rendering complexity
- **Browser Support**: CSS features used, fallbacks needed
- **Internationalization**: Text direction, character sets, dynamic content
- **Dark Mode**: Color tokens, theme switching, contrast
- **Print Styles**: If the design should be printable

## Notes

- If the frame is very complex, offer to analyze sections separately
- Suggest improvements to the Figma design if appropriate
- Note any Figma-specific features that don't translate to code
- Recommend collaboration points between design and engineering

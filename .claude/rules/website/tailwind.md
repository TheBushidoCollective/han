# Tailwind v4 Dark Mode

Tailwind v4 uses a CSS-first approach. If dark mode isn't working:

1. Add `@source` directives to your CSS to tell Tailwind where to find classes:

   ```css
   @import "tailwindcss";
   
   @source "../app";
   @source "../components";
   ```

2. The `tailwind.config.ts` content paths may not be read in v4
3. Dark mode works automatically via `prefers-color-scheme` media queries
4. Verify by checking build output for `dark:` classes

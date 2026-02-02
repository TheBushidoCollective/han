# Han Marketing Website

[![codecov](https://codecov.io/gh/thebushidocollective/han/graph/badge.svg?flag=website)](https://codecov.io/gh/thebushidocollective/han)

This is the marketing website for Han. It's built with Next.js and deployed to GitHub Pages at [https://han.guru](https://han.guru).

## Features

- Modern, responsive design with Tailwind CSS
- Static site generation for optimal performance
- Showcases the three pillars: Knowledge, Action, and Discipline
- Explains plugin categories (Core, Jutsu, Do, Hashi, Bushido)
- Provides installation instructions
- Hosts marketplace.json at `/marketplace.json`

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

The development server will be available at [http://localhost:3000](http://localhost:3000).

## Deployment

The website is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by the `.github/workflows/deploy-website.yml` workflow.

### Prerequisites

1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. Configure custom domain (han.guru) in repository settings

### Build Process

1. Next.js builds static HTML/CSS/JS files
2. marketplace.json is copied from `.claude-plugin/marketplace.json` to the public directory
3. Static files are exported to the `out/` directory
4. GitHub Actions deploys the `out/` directory to GitHub Pages
5. Custom domain (han.guru) is configured via CNAME file

## Custom Domain

The website is configured to use the custom domain `han.guru`. The CNAME file in the `public/` directory ensures the domain is preserved after deployment.

To configure the custom domain:

1. Add CNAME record in DNS: `CNAME han.guru <username>.github.io`
2. Configure custom domain in GitHub repository settings
3. Wait for DNS propagation

## Marketplace.json

The marketplace.json file is automatically copied from the root `.claude-plugin/marketplace.json` during:

1. Local builds (`npm run build`)
2. GitHub Actions deployment

This ensures the marketplace metadata is always available at `https://han.guru/marketplace.json`.

## Technology Stack

- **Next.js 15** - React framework with static export
- **React 19** - UI library
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - CI/CD pipeline

## Project Structure

```
website/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Homepage
│   └── globals.css      # Global styles
├── public/
│   ├── marketplace.json # Plugin marketplace metadata
│   ├── CNAME           # Custom domain configuration
│   └── .nojekyll       # Disable Jekyll processing
├── next.config.js      # Next.js configuration
├── tailwind.config.ts  # Tailwind CSS configuration
└── package.json        # Dependencies and scripts
```

## License

FSL-1.1-ALv2 - see [LICENSE](../LICENSE) for details.

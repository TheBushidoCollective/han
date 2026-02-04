---
status: pending
depends_on: []
branch: ai-dlc/ai-dlc-website/01-repo-setup
discipline: devops
---

# unit-01-repo-setup

## Description

Create the new `ai-dlc` monorepo with proper structure, tooling, and CI/CD pipelines.

## Discipline

devops - This unit will be executed by infrastructure/deployment focused agents.

## Success Criteria

- [ ] Repository created at `github.com/thebushidocollective/ai-dlc`
- [ ] Monorepo structure with `/website` and `/plugin` directories
- [ ] Root `package.json` with workspace configuration
- [ ] GitHub Actions workflow for deploying website to GitHub Pages
- [ ] Branch protection rules on main
- [ ] CODEOWNERS file configured
- [ ] README.md with project overview

## Notes

- Use pnpm or bun workspaces for monorepo management
- GitHub Pages deployment should trigger on push to main
- Consider using `actions/configure-pages` and `actions/deploy-pages`
- Custom domain configuration will be done after initial deployment works

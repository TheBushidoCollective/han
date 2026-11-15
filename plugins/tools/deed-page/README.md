# deed.page

Publish a file or a clean output folder (an HTML report, slide deck, dashboard, prototype or a `dist/` build) to a public `https://<slug>.deed.page/` URL. No account or API key; the first publish mints an owner token that the skill keeps in `~/.config/deed-page/token` (mode 600) and never prints.

## Skills

- **deed-page**: Uploads only when the user asks to publish, host or share a link, or confirms a preview of the public URL and the exact file list. A create-only request stays local. The bundled `scripts/publish.sh` skips `.env*`, `.git`, `node_modules`, keys and other dotfiles, and `--dry-run` shows the file list without uploading.

## Installation

```bash
han plugin install deed-page
```

Or in Claude Code:

```
/plugin marketplace add TheBushidoCollective/han
/plugin install deed-page@han
```

Requires `curl` and `tar` (Node 18+ for folders over about 4 MB) and network access to https://deed.page. Hosting is public: anyone with the link can view the files.

## Source

Vendored from [f-o-x11/deed-page-skill](https://github.com/f-o-x11/deed-page-skill/tree/16e00cb963b0770f6a7da20cee52f5d1ea6ea4bf/skills/deed-page), maintained by the deed.page team (MIT, see [LICENSE](LICENSE)). Docs: https://deed.page/docs. Please report skill-level issues upstream.

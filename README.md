---
last_updated: 2026-10-20T11-25
---

# Taller editor

The editor grows one wrapped text row at a time. Its borders and autocomplete share a limit of half the terminal height. The limit also reserves eight chat rows after the footer, widgets, queued messages, and status rows. It recalculates at each render, including after zoom and resize.

Pi enforces a minimum of five visible text rows. Extremely short windows or large completion menus can therefore exceed the limit or leave fewer than eight chat rows. The draft remains scrollable and keeps its cursor visible.

The extension uses Pi's custom-editor API and native wrapping, editing, and scrolling. Pi 1.3.0 has no editor-height option, so the extension changes the terminal-row value only during native editor rendering. It measures the input dock through Pi's public component tree. Tests use Pi's real fullscreen layout.

## Install from GitHub

This is a private personal extension. Git needs access to giladbarnea/taller-editor. It does not publish to npm.

```sh
pi install git:github.com/giladbarnea/taller-editor
```

The unpinned source follows the default branch when you run `pi update --extensions`. Add `@v0.1.0` to pin a release. Run `/reload` after changing the install.

## Develop and release

Use Node.js 24 or newer.

```sh
npm ci --ignore-scripts
npm run setup
npm run check
npm run release -- patch
git push origin main --follow-tags
```

The pre-push hook runs the checks. GitHub checks main, pull requests, and version tags. A passing version tag creates a GitHub release with generated notes. The tag must match package.json. No workflow publishes to npm or GitHub Packages, and package.json sets `private: true`.

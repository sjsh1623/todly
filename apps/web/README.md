# todly-web

React 18 + TypeScript + Vite + Tailwind + PWA frontend for **todly** (Phase 0 scaffold).

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on Vite's default port (5173) and proxies:

- `/api` → `http://localhost:8080`
- `/ws` → `http://localhost:8080` (WebSocket upgrade)

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with API proxy. |
| `npm run build`   | Type-check (`tsc -b`) + Vite build.  |
| `npm run preview` | Preview the production build.         |

## Structure

```
src/
  app/router.tsx        # createBrowserRouter, AppShell + 5 tab routes
  pages/                # Home, Groups, Activity, Routine, Profile placeholders
  shared/
    tokens/tokens.css   # CSS variable design tokens (source of truth)
    ui/                 # AppShell, BottomNav, Avatar, ProgressBar, Card, Button, FAB
  index.css             # Tailwind layers + base body styles
  main.tsx              # App entry (QueryClient + RouterProvider)
```

## Design tokens

Design tokens live in `src/shared/tokens/tokens.css` as CSS variables and are mapped
into Tailwind via `tailwind.config.js`. Themes are switched with the `data-theme`
attribute (`ocean`, `mint`, `violet`, `coral`, `sunset`); dark mode via `data-dark="true"`.

## Docker

```bash
docker build -t todly-web .
docker run -p 80:80 todly-web
```

The image builds with `node:20-alpine` and serves the static `dist/` via `nginx:alpine`,
proxying `/api` and `/ws` to the `api` service on port 8080 (see `nginx.conf`).

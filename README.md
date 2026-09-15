# Life Replay

**Turn your life into a story.**

Life Replay is a mobile-first memory product built around a simple loop: **capture → remember → replay → share**.

## What works today

- Premium responsive timeline UI
- Add multiple photos directly from a phone or desktop
- Local persistence with browser storage
- Memory detail and deletion
- Search memories and filter by place
- Replay/story mode
- Native share support with a shareable replay URL fallback
- JSON backup export/import
- Installable PWA with offline shell
- No account required for the MVP
- Static-hosting friendly

### Privacy note

The MVP stores imported memories locally in the browser. A shared replay URL contains memory metadata, not the original private photos. Real cloud accounts, encrypted storage and granular public/private sharing belong in the production backend phase.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Or:

```bash
npm run dev
```

## Structure

- `index.html` — application entry point and PWA metadata
- `app.js` — application state, timeline, persistence, import/export and sharing
- `style.css` — responsive product styling
- `manifest.webmanifest` — installable web-app manifest
- `sw.js` — offline service worker
- `src/main.jsx` / `src/styles.css` — retained React prototype files

## Production roadmap

1. Backend authentication and account recovery
2. Object storage for original photos/videos and thumbnails
3. EXIF date/location extraction and privacy controls
4. AI-assisted captions, clustering and duplicate detection
5. Automatic monthly/yearly story generation
6. Cinematic replay video generation
7. Public share pages with expiring links and access controls
8. Mobile apps with background photo indexing
9. Collaborative memories for families/friends
10. Viral templates, referral links and yearly recap campaigns

## Product principle

Keep the core experience effortless: **capture → remember → replay → share**.

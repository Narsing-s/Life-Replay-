# Life Replay

**Turn your life into a story.**

Life Replay is a mobile-first memory timeline MVP. Add photos, revisit moments, play a replay view, and share a simple story summary.

## Current MVP

- Premium responsive timeline UI
- Add image memories directly from the browser
- Memory detail modal
- Remove memories
- Memory/place/year statistics
- Replay story view
- Native share support with clipboard fallback
- No login required
- Static deployment friendly

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

- `index.html` — application entry point
- `app.js` — MVP application logic
- `style.css` — production MVP styles
- `src/main.jsx` — retained React prototype placeholder
- `src/styles.css` — retained React prototype styles

## Product roadmap

1. Real accounts and private memory storage
2. EXIF date/location extraction
3. AI captions and memory clustering
4. Automatic yearly/monthly story generation
5. Cinematic replay video generation
6. Public share pages with privacy controls
7. Mobile apps and offline support
8. Viral referral and collaborative memories

## Product principle

The experience should stay simple: **capture → remember → replay → share**.

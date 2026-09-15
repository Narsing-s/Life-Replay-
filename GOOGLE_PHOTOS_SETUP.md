# Google Photos connection

Life Replay now has a real browser-side Google Photos authorization and import flow.

## What it does

1. Opens Google OAuth using Google Identity Services.
2. Requests the read-only `photoslibrary.readonly` scope.
3. Searches the authenticated user's Google Photos library.
4. Lets the user filter Photos only, Videos only, or Photos + videos.
5. Shows returned media in a selectable grid.
6. Imports selected items into the Life Replay timeline.
7. Stores the Google Photos media ID and metadata locally. Google `baseUrl` values are temporary and are not treated as permanent storage.

Google documents that `photoslibrary.readonly` allows an app to view a user's Google Photos library and that `mediaItems:search` supports filters such as media type and date. Google also notes that media `baseUrl` values expire, so applications should retain media IDs instead of permanently caching those URLs.

## One-time Google Cloud setup

Create a Google Cloud project and enable the **Google Photos Library API**.

Create an **OAuth 2.0 Client ID** for a **Web application**.

In the OAuth client configuration, add the exact site origin under **Authorized JavaScript origins**. For a GitHub Pages deployment this will be the GitHub Pages origin, for example:

`https://YOUR-GITHUB-USERNAME.github.io`

If you use a custom domain, add that origin instead.

For local testing, also add:

`http://localhost:4173`

or the exact origin/port used by your local server.

Google's credential documentation explains that web applications need their browser origin configured on the OAuth client.

## Connect in Life Replay

Open **Google Photos** in Life Replay and paste the OAuth Web Client ID. It looks similar to:

`1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com`

The client ID is saved in the browser so you do not need to paste it on every visit. It is not a client secret.

Then choose **Connect & choose photos**, approve read-only access, and select memories to import.

## Important production notes

- Do not put a Google client secret in the frontend.
- Life Replay requests read-only Google Photos access; it does not request permission to delete or modify the user's library.
- Google OAuth/Photos scopes can be sensitive and public applications may need Google's verification process before broad public release.
- The current GitHub Pages version uses a short-lived browser access token. It does not store a Google refresh token.
- For a future signed-in production architecture, move OAuth to the Life Replay backend and use authorization code + PKCE/server-side token handling.

## Official references

- Google OAuth scopes: https://developers.google.com/identity/protocols/oauth2/scopes
- Google Photos filters/search: https://developers.google.com/photos/library/guides/apply-filters
- Google Photos media access: https://developers.google.com/photos/library/legacy/guides/access-media-items
- Google web credentials: https://developers.google.com/workspace/guides/create-credentials

# Next deployment verification

After merging this branch into `main`, redeploy the Render service so the running API contains the CORS and security changes.

Verify:

- `GET /api/health` returns `200`.
- An `OPTIONS /api/auth/register` request from `https://narsing-s.github.io` returns `204` and `Access-Control-Allow-Origin: https://narsing-s.github.io`.
- Registration returns `201` and a token.
- Login returns `200` and a token.
- Authenticated `/api/v1/profile` returns the user's profile.
- Authenticated `/api/v1/readiness` reports database/storage/AI status.
- GitHub Pages can create a memory and reload the timeline.

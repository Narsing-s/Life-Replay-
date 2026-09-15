# GitHub Pages one-time setup

The repository contains a standard GitHub Pages Actions workflow. GitHub's Actions token can deploy an already-enabled Pages site, but it cannot create a new Pages site for a repository when the site has never been enabled. If the workflow reports `Create Pages site failed: Resource not accessible by integration`, enable Pages once in the repository settings.

## Enable it once

1. Open the Life Replay repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Return to **Actions** and rerun **Deploy Life Replay to GitHub Pages**, or push another commit.

After that, pushes to `main` use the workflow automatically.

## Google OAuth origin

For Google Photos, the OAuth Web Client's **Authorized JavaScript origins** must contain only the origin, not the repository path. For the standard GitHub Pages project site this is:

`https://narsing-s.github.io`

The application URL is normally:

`https://narsing-s.github.io/Life-Replay-/`

Also add your local development origin, such as `http://localhost:4173`, if you test locally.

## Why this is required

GitHub documents the Pages Actions workflow as requiring `pages: write` and `id-token: write`, but the Pages site itself must be enabled/configured for Actions deployment. The repository workflow therefore no longer tries to create the Pages site automatically.

# Safe deployment order

1. Merge the feature branch into `main`.
2. Redeploy the Render API from `main`.
3. Verify `/api/health` and GitHub Pages CORS preflight.
4. Verify registration and login.
5. Verify an authenticated memory create/read flow.
6. Verify export and account deletion only with a test account.
7. Configure production providers before enabling provider-dependent features.

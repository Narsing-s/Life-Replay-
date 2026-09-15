# Life Replay — Cloud Run deployment

Render is not required. The recommended backend target is Google Cloud Run.

## Important storage architecture

Cloud Run containers are stateless. Do **not** treat `/app/data` or `/tmp` as permanent lifetime storage.

For production Life Replay:

- Cloud Run: stateless Node.js API
- PostgreSQL: users, memories, tags, people, relationships, jobs and metadata
- Object storage: original photos, videos, audio, documents and thumbnails
- Secret Manager: JWT and provider secrets
- Optional Cloud Tasks/Pub/Sub: AI, imports, thumbnails and backup jobs

There is no application-level memory-count limit. A user's number of memories is constrained only by the capacity/quota/cost of the configured database and object storage.

## Current repository container

The repository already has a Dockerfile and `npm start` entrypoint. The Cloud Run service should listen on the `PORT` environment variable.

## Deploy

1. Create/select a Google Cloud project.
2. Enable Cloud Run, Artifact Registry, Cloud Build and Secret Manager.
3. Create an Artifact Registry Docker repository named `life-replay`.
4. Create a JWT secret:

```bash
gcloud secrets create life-replay-jwt --replication-policy=automatic
echo -n "REPLACE_WITH_A_LONG_RANDOM_SECRET" | gcloud secrets versions add life-replay-jwt --data-file=-
```

5. Build and push:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/life-replay/life-replay:latest
```

6. Deploy:

```bash
gcloud run deploy life-replay-api \
  --image REGION-docker.pkg.dev/PROJECT_ID/life-replay/life-replay:latest \
  --region REGION \
  --port 4173 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://narsing-s.github.io \
  --set-secrets JWT_SECRET=life-replay-jwt:latest
```

7. Copy the generated `https://*.run.app` URL.
8. Set the frontend API base to that Cloud Run URL instead of the old Render URL.
9. Redeploy GitHub Pages.

## Production migration before real lifetime data

The current legacy implementation uses SQLite/local uploads. That is suitable for development but is not the final architecture for a lifetime-memory product. Before relying on it for real personal data, migrate the persistence layer to managed PostgreSQL and object storage, then make media uploads use signed object-storage URLs.

## Free/low-cost note

Cloud Run has a monthly free tier for eligible usage, including request-based CPU, memory and requests. The free tier does not mean unlimited storage; database, object storage, networking and other services have their own quotas/pricing.

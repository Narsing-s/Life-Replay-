# API Reference

Base URL: the deployed Life Replay backend.

## Health

### `GET /api/health`

Returns service health information. Use this endpoint for deployment health checks.

## Configuration

### `GET /api/config`

Returns safe public runtime configuration. Secrets must never be returned.

## Authentication

### `POST /api/auth/register`

Request:

```json
{
  "name": "Narsing",
  "email": "user@example.com",
  "password": "at-least-8-characters"
}
```

Returns a public user object and JWT token on success.

### `POST /api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "at-least-8-characters"
}
```

Returns a public user object and JWT token on success.

## Current user

### `GET /api/me`

Requires:

```text
Authorization: Bearer <token>
```

## Memories

### `GET /api/memories`

Returns memories belonging to the authenticated user.

### `POST /api/memories`

Creates a memory using a multipart upload. Requires a Bearer token.

### `DELETE /api/memories/:id`

Deletes a memory owned by the authenticated user.

## Sharing

### `POST /api/share`

Creates a public share token for an authenticated story/memory collection.

### `GET /api/share/:token`

Reads a public story represented by a valid share token.

## Errors

Clients should treat non-2xx responses as failures and display the server's `error` message when present. Clients must not expose raw secrets, stack traces, or private database details to end users.

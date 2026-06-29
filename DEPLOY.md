# Deploying Maths for ML

A self-contained Docker stack: **Traefik** (reverse proxy + automatic HTTPS) serves the **static**
Astro site and routes by **domain name**, so it coexists with your existing services on ports 80/443.

```
            ┌─────────── server (ports 80, 443) ───────────┐
internet ─▶ │  Traefik  ──Host(maths.example.com)──▶ maths-llm (nginx)
            │           ──Host(app.example.com)─────▶ your-existing-service
            └───────────────────────────────────────────────┘
```

## Prerequisites
- A server with **Docker** + **Docker Compose v2** (`docker compose version`).
- Ports **80** and **443** open to the internet and not already bound by something else
  (if your existing service currently binds them directly, see “Coexisting” below).
- A **DNS A record** for your domain pointing at the server's public IP, created **before** first run
  (Let's Encrypt validates over HTTP on port 80).

## Deploy
```bash
# 1. Configure
cp .env.example .env
nano .env            # set DOMAIN=maths.yourdomain.com and ACME_EMAIL=you@yourdomain.com

# 2. Build and start
docker compose up -d --build

# 3. Watch the certificate get issued
docker compose logs -f traefik     # look for the `le` resolver obtaining a cert; Ctrl-C to exit
docker compose ps                  # both traefik and maths-llm should be Up
```
Then open `https://$DOMAIN`. HTTP automatically 301-redirects to HTTPS.

> **Tip — dry run:** Let's Encrypt has strict rate limits. To test issuance first, uncomment the
> `acme.caserver` *staging* line in `docker-compose.yml`, run once (you'll get an untrusted “staging”
> cert — that's expected), then comment it out, run `docker compose down && docker volume rm maths-llm_letsencrypt`
> (or delete the `letsencrypt` volume) and bring it up again for the real cert.

## Coexisting with your existing service (domain-based routing)
The stack creates a shared Docker network named **`web`** and Traefik only exposes containers that
carry `traefik.enable=true` labels. To route your other service by its own domain, attach it to `web`
and add labels — **no second proxy, no port conflicts**.

If your existing service binds ports 80/443 itself, remove those `ports:` mappings first (Traefik owns
80/443 now) and let Traefik route to it instead.

Add to the existing service's `docker-compose.yml`:
```yaml
services:
  your-existing-service:
    # ...your existing config...
    expose:
      - "8080"                       # the port your app listens on (do NOT publish to host)
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`app.yourdomain.com`)"
      - "traefik.http.routers.myapp.entrypoints=websecure"
      - "traefik.http.routers.myapp.tls=true"
      - "traefik.http.routers.myapp.tls.certresolver=le"
      - "traefik.http.services.myapp.loadbalancer.server.port=8080"

networks:
  web:
    external: true                   # reuse the network created by this stack
```
Point `app.yourdomain.com`'s DNS at the same server, then `docker compose up -d`. Traefik picks it up
automatically and provisions its certificate too.

## Updating the site
```bash
git pull            # or copy new files
docker compose up -d --build maths-llm
```

## Useful commands
```bash
docker compose logs -f maths-llm     # nginx access/error logs
docker compose restart traefik
docker compose down                  # stop (certs persist in the `letsencrypt` volume)
```

## Optional: Traefik dashboard
Add to the `traefik` service `command:` and expose it behind auth/your domain (don't leave it open):
```
- "--api.dashboard=true"
```
then add a labeled router with `Host(...)` + basic-auth middleware. Omitted by default for security.

## Notes
- The image is two-stage: Node builds the static site, then a tiny **nginx** image serves it — no Node
  at runtime. nginx config (`nginx.conf`) gzips responses and long-caches hashed `/_astro/` assets.
- For correct canonical URLs you may set `site: 'https://maths.yourdomain.com'` in `astro.config.mjs`
  and rebuild (optional; the site works without it).
- Certificates auto-renew; the `letsencrypt` volume persists them across restarts.

## Local smoke test (no domain needed)
```bash
docker build -t maths-llm:local .
docker run --rm -p 8080:80 maths-llm:local
# open http://localhost:8080  (try /path, /book, and a lesson)
```

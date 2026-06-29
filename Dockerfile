# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static site ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Build the static output into /app/dist
COPY . .
RUN npm run build

# ---------- Stage 2: serve with nginx ----------
FROM nginx:1.27-alpine AS runtime

# Our static-site server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The built site
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic container healthcheck (nginx serving the homepage)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

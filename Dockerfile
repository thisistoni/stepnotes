# The Waltzy web app for self-hosting: a static export served by nginx.
# People open shared dances (/s/<id>) and classes (/c/<code>) here; the phone app's links and
# QR codes point at this address (see WEB_ORIGIN in src/lib/cloud/config.ts).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

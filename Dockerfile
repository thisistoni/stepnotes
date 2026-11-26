# The Waltzy website for self-hosting: a static export served by nginx.
# The phone app's links and QR codes (/s/<id>, /c/<code>) point at this address (see WEB_ORIGIN in
# src/lib/cloud/config.ts). On a phone with Waltzy they open the app; in a browser the site shows
# "Open in Waltzy" and where to get the app, plus the terms and the privacy policy. It also serves
# /.well-known/apple-app-site-association, which is what makes the links open the app.
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

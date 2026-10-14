# Build context is the REPO ROOT (see docker-compose.yml).
FROM node:26.5-alpine AS build
WORKDIR /repo/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

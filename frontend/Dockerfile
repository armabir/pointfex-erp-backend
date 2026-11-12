# Stage 1: Vite Production Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_ENABLE_DEMO_LOGIN=false
ARG VITE_DEMO_PASSWORD=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_DEMO_LOGIN=$VITE_ENABLE_DEMO_LOGIN
ENV VITE_DEMO_PASSWORD=$VITE_DEMO_PASSWORD

RUN npm run build

# Stage 2: Nginx Static SPA + Reverse Proxy
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

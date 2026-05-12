FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copiamos el código fuente
COPY . .

# Definimos que esperamos una variable llamada VITE_API_URL
ARG VITE_API_URL
# La convertimos en variable de entorno para que Vite la vea durante el build
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build
# ------------------------------

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

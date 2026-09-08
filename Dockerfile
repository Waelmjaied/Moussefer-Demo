# ---------- Étape 1 : build Angular ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copier uniquement les manifests d'abord -> profite du cache Docker
COPY package*.json ./
RUN npm ci

# Copier le reste du code et builder en production
COPY . .
RUN npm run build -- --configuration production

# ---------- Étape 2 : servir avec Nginx ----------
FROM nginx:1.27-alpine AS runtime

# Remplacer la config par défaut par celle adaptée au routing Angular
COPY nginx.conf /etc/nginx/conf.d/default.conf

# IMPORTANT : adapte ce chemin au nom réel de ton projet Angular
# (visible dans angular.json -> "outputPath", souvent dist/<nom-app>/browser)
COPY --from=build /app/dist/moussefer-frontend/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

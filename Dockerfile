# syntax=docker/dockerfile:1

# Version de npm épinglée, et identique à celle qui a généré
# package-lock.json. Sans cet épinglage, la version de npm embarquée dans
# node:24-alpine évolue avec l'image de base, et deux versions de npm ne
# résolvent pas l'arbre de dépendances à l'identique : `npm ci`, qui est
# strict, rejette alors un lockfile pourtant valide. Constaté deux fois en
# déploiement, sur les paquets @emnapi tirés par le repli wasm de sharp.
#
# Pour mettre à jour les dépendances, régénérer le lockfile avec cette
# même version :  npx --yes npm@11.16.0 install
ARG NPM_VERSION=11.16.0

FROM node:24-alpine AS deps
ARG NPM_VERSION
WORKDIR /app
RUN npm install -g npm@${NPM_VERSION}
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Aucune variable de configuration n'est nécessaire au build : la config
# Supabase est lue au runtime par le serveur (voir lib/supabase/config.ts).
# L'image est donc indépendante de l'environnement où elle tourne.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

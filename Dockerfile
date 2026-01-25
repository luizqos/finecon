# ESTÁGIO 1: Dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ESTÁGIO 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build # Gera dist/ e .next/

# ESTÁGIO 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Desabilita telemetria para performance
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 1. Copia os arquivos do modo standalone do Next.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 2. Copia a pasta dist do seu backend compilado
COPY --from=builder /app/dist ./dist

# 3. IMPORTANTE: Como o standalone não traz os módulos do backend, 
COPY --from=builder /app/node_modules ./node_modules

# Garante permissões na pasta de uploads
RUN mkdir -p uploads && chown nextjs:nodejs uploads

USER nextjs

EXPOSE 9000 9001

# O comando start agora encontrará o 'express' e o 'concurrently'
CMD ["npm", "run", "start"]
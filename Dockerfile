# ESTÁGIO 1: Dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ESTÁGIO 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# LIMITAÇÃO DE MEMÓRIA: Evita que o Node tente usar mais RAM do que o disponível
ENV NODE_OPTIONS="--max-old-space-size=768"
# Desabilita telemetria para reduzir overhead de rede e processamento
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ESTÁGIO 3: Runner (Imagem final de produção)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p uploads && chown nextjs:nodejs uploads

USER nextjs

EXPOSE 9000 9001

CMD ["npm", "run", "start"]
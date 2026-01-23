# ESTÁGIO 1: Dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Cache de pacotes: Só reinstala se o package.json mudar
COPY package.json package-lock.json ./
RUN npm ci

# ESTÁGIO 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cache do Next.js: Acelera builds subsequentes
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ESTÁGIO 3: Runner (Produção)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário para rodar
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

EXPOSE 9000 9001
CMD ["npm", "run", "start"]
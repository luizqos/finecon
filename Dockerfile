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
RUN touch .env.local && npm run build # Gera dist/ e .next/

# ESTÁGIO 3: Runner (Produção)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Criar usuário de segurança
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copiar apenas o necessário do modo standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/package.json ./package.json

# Garantir pasta de uploads
RUN mkdir -p uploads && chown nextjs:nodejs uploads
USER nextjs

EXPOSE 9000 9001
CMD ["npm", "run", "start"]
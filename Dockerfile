# ESTÁGIO 1: Dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ESTÁGIO 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cria um arquivo .env.local vazio para passar no pre-flight check
#RUN touch .env.local

# Desabilita a telemetria do Next.js durante o build
ENV NEXT_TELEMETRY_DISABLED=1

# Executa o preflight e o build do Next.js e do Server (TypeScript)
RUN npm run prebuild && npm run build

# ESTÁGIO 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Cria o usuário para rodar a aplicação (segurança)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia os arquivos necessários para o backend e frontend
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Garante permissões na pasta de uploads
RUN mkdir -p uploads && chown nextjs:nodejs uploads

USER nextjs

# O servidor Express roda na 3001, o Next na 3000
EXPOSE 3000 3001

# Comando para iniciar o servidor (ajuste conforme seu script de start)
CMD ["npm", "run", "start"]
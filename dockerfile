# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependências primeiro (para cache eficiente)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copia o código e assets
COPY . .

# Compila TypeScript
RUN npm run build

# Copia arquivos estáticos para a pasta de saída, caso necessário
# (ajuste os caminhos se forem diferentes)
RUN mkdir -p dist/public && \
    if [ -d "public" ]; then cp -r public/* dist/public/ || true; fi

# Etapa 2: runtime
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copia build e public (já copiado na etapa anterior para dist/public)
COPY --from=builder /app/dist ./dist

# Exponha a porta
EXPOSE 3000

# Comando de start
CMD ["node", "dist/app.js"]
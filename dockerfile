# Usa Node.js com suporte ao npm
FROM node:18-alpine

# Define a pasta de trabalho no container
WORKDIR /usr/src/app

# Copia apenas arquivos de dependências primeiro (melhora cache)
COPY package*.json ./

RUN npm install

# Copia todo o código, incluindo tsconfig.json e src
COPY . .

# Instala TypeScript globalmente
RUN npm install -g typescript

# Compila o projeto inteiro usando o tsconfig.json
RUN tsc

# Expõe a porta da aplicação
EXPOSE 3000

# Roda a versão compilada
CMD ["node", "dist/app.js"]

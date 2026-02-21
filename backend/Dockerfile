FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" npx prisma generate
RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/index.js"]

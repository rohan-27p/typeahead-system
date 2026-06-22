FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npm run seed && npm start"]

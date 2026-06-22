FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# We copy Prisma schema first so we can generate the client
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# We map port 3001
EXPOSE 3001

# Run in dev mode using nodemon
CMD ["npm", "run", "dev"]

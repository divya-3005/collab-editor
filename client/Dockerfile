FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Use --legacy-peer-deps since we had that conflict previously with tiptap
RUN npm install --legacy-peer-deps

COPY . .

# Vite default port
EXPOSE 5173

# Expose Vite on all network interfaces (needed for Docker port mapping to work)
CMD ["npm", "run", "dev", "--", "--host"]

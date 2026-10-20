FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript @types/node @types/express @types/cors @types/morgan tsx && npm run build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]

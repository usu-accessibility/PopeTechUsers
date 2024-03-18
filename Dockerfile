FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=3020

EXPOSE 3020

CMD ["node", "index.js"]
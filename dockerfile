FROM node:18
RUN apt-get update && apt-get install -y fonts-dejavu ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
FROM node:16.17.0-slim

RUN apt-get update && apt-get install -y make g++ python3
RUN apt-get update && apt-get --yes install ca-certificates && update-ca-certificates

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
CMD [ "bash" ]

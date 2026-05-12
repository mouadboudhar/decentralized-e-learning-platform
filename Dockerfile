FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY hardhat.config.js ./
COPY contracts/ ./contracts/
COPY scripts/ ./scripts/

# Pre-compile so artifacts are ready when the container starts
RUN npx hardhat compile

COPY docker-entrypoint.sh healthcheck.js ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8545
ENTRYPOINT ["./docker-entrypoint.sh"]

# =============================================================================
# DOCKERFILE PARA TESTES AUTOMATIZADOS - CONECTA HEAL
# =============================================================================

FROM node:24-alpine

WORKDIR /app

COPY test/package.json ./
COPY test/server.js ./
COPY test/routes.js ./
COPY test/controller.js ./
COPY test/ldapService.js ./
COPY test/jest.config.js ./
COPY test/jest.setup.js ./
COPY test/api.test.js ./
COPY test/integ.test.js ./
COPY test/data.test.js ./
COPY test/middleware ./middleware
COPY test/frontend ./frontend

RUN npm install

ENV API_URL=http://node:3006
ENV PORT=3007

EXPOSE 3007

CMD ["node", "server.js"]
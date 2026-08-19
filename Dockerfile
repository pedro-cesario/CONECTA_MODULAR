# =============================================================================
# DOCKERFILE PARA API NODE.JS COM ORACLE INSTANT CLIENT 19C
# =============================================================================
# Este Dockerfile cria uma imagem Node.js 18 Alpine com:
# - Oracle Instant Client 19c (modo Thick)
# - Suporte a bancos Oracle 11g, 12c, 18c, 19c
# - Dependências para compilação native modules
#
# PARA USAR EM NOVO PROJETO:
# 1. Copie este arquivo para o novo projeto
# 2. Copie a pasta instantclient-files com o Instant Client 19c
# 3. Edite o CMD no final para apontar para seu server.js
# 4. Edite o WORKDIR se necessário
# =============================================================================

# Imagem base: Node.js 24 Alpine (leve e segura)
FROM node:24-alpine

# ---------------------------------------------------------------------------
# INSTALAÇÃO DE DEPENDÊNCIAS DO SISTEMA
# ---------------------------------------------------------------------------
# python3, make, g++, sqlite-dev: para compilar native modules (ex: sqlite3)
# libaio: necessário para Oracle Instant Client
# curl, unzip: para downloads
# libc6-compat, libnsl: compatibilidade com bibliotecas glibc
RUN apk add --no-cache \
    python3 make g++ sqlite-dev \
    libaio curl unzip libc6-compat libnsl su-exec

# ---------------------------------------------------------------------------
# INSTALAÇÃO DO ORACLE INSTANT CLIENT 19C
# ---------------------------------------------------------------------------
# Cria diretório para o Instant Client
RUN mkdir -p /opt/oracle/instantclient/network/admin

# Copia os arquivos do Instant Client (copie a pasta instantclient-files)
COPY instantclient-files /opt/oracle/instantclient/

# Configura symlinks necessários para o Oracle
# IMPORTANTE: Arquivos .so do Windows são symlinks quebrados
# Por isso deletamos e recriamos dentro do container
RUN cd /opt/oracle/instantclient && \
    # Remove symlinks quebrados que vieram do Windows
    rm -f libipc1.so libmql1.so libocci.so libclntsh.so libclntshcore.so 2>/dev/null || true && \
    # Cria symlinks corretos para as bibliotecas principais
    ln -sf libclntsh.so.19.1 libclntsh.so && \
    ln -sf libclntshcore.so.19.1 libclntshcore.so && \
    # Cria symlink para libnsl (necessário para Oracle 12c)
    ln -sf /usr/lib/libnsl.so.3 /usr/lib/libnsl.so.1 && \
    # Lista as bibliotecas para debug
    ls -la *.so*

# ---------------------------------------------------------------------------
# VARIÁVEIS DE AMBIENTE DO ORACLE
# ---------------------------------------------------------------------------
ENV ORACLE_HOME=/opt/oracle/instantclient
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient
ENV TNS_ADMIN=/opt/oracle/instantclient
ENV PATH=$ORACLE_HOME:$PATH

# ---------------------------------------------------------------------------
# PREPARAÇÃO DO DIRETÓRIO DA APLICAÇÃO
# ---------------------------------------------------------------------------
# Cria diretório da app e define permissões
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

# Muda para usuário node (não root - melhor segurança)
USER node
WORKDIR /home/node/app

# ---------------------------------------------------------------------------
# INSTALAÇÃO DAS DEPENDÊNCIAS NODE
# ---------------------------------------------------------------------------
# Copia package.json primeiro (usa cache do Docker)
COPY --chown=node:node package*.json ./

# Instala dependências (usando ci para garantir integridade via lockfile)
RUN npm ci

# Copia o resto da aplicação
COPY --chown=node:node . .

# O processo inicia como root apenas para normalizar permissões dos bind mounts
# e o entrypoint reduz os privilégios para o usuário node antes de iniciar a API.
USER root
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/conecta-entrypoint
RUN chmod 755 /usr/local/bin/conecta-entrypoint

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO FINAL
# ---------------------------------------------------------------------------
# Porta exposta (corresponde à variável PORT)
EXPOSE 3006

ENV PORT=3006
ENV NODE_ENV=production

ENTRYPOINT [ "conecta-entrypoint" ]

# EDITE AQUI: Aponta para o entry point da aplicação
CMD [ "node", "backend/server.js" ]

# =============================================================================
# NOTAS IMPORTANTES
# =============================================================================
#
# 1. INSTANT CLIENT 19C:
#    - Baixe de: https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
#    - Use o pacote "Basic" (não Basic Lite) para ter libclntsh.so
#    - Extraia na pasta "instantclient-files" na raiz do projeto
#
# 2. VERSÃO DO ORACLE:
#    - 19c: Recomendado, suporta Oracle 11g+
#    - O Instant Client 19c funciona com bancos 12c e 19c
#
# 3. MODO THICK vs THIN:
#    - Thick: Usa libclntsh.so local (mais compatível, suporta senhas antigas)
#    - Thin: Conexão pura Java (mais simples, menos compatível)
#    - Este Dockerfile configura Thick mode
#
# 4. PARA NOVO PROJETO:
#    - Copie: docker-compose.yml, Dockerfile, instantclient-files/
#    - Edite: container_name, PORT, CMD, .env
#    - Mantenha: estrutura de pastas backend/, frontend/, package.json
#
# =============================================================================

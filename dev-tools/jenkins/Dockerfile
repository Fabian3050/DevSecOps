FROM jenkins/jenkins:lts

USER root

# Instalar dependencias básicas
RUN apt-get update && \
    apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    python3 \
    python3-pip

# Instalar Docker CLI usando el script oficial (método más confiable)
RUN curl -fsSL https://get.docker.com -o get-docker.sh && \
    sh get-docker.sh --dry-run && \
    sh get-docker.sh && \
    rm get-docker.sh

# Alternativa: Instalar solo el binario de Docker CLI
# RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz | \
#     tar xzvf - --strip 1 -C /usr/local/bin docker/docker && \
#     chmod +x /usr/local/bin/docker

# Dar permisos al usuario jenkins para usar Docker
RUN usermod -aG docker jenkins

# Limpiar
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

USER jenkins

# Pre-instalar plugins esenciales
RUN jenkins-plugin-cli --plugins \
    git \
    workflow-aggregator \
    docker-workflow \
    credentials-binding \
    htmlpublisher \
    pipeline-stage-view

# Exponer puertos
EXPOSE 8080 50000

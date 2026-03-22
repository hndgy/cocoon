FROM node:lts-slim

ARG UID=1000
ARG GID=1000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git \
      build-essential \
      curl \
      ca-certificates \
      openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

RUN groupadd -g ${GID} claude || true && \
    useradd -m -u ${UID} -g ${GID} -s /bin/bash claude

USER claude
WORKDIR /workspace

ENTRYPOINT ["sleep", "infinity"]

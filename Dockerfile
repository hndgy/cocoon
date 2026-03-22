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

RUN groupadd -g ${GID} claude || true && \
    useradd -m -u ${UID} -g ${GID} -s /bin/bash claude

# Install Claude Code via native installer as claude user
USER claude
SHELL ["/bin/bash", "-c"]
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/claude/.local/bin:${PATH}"
WORKDIR /workspace

ENTRYPOINT ["sleep", "infinity"]

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
# CLAUDE_CONFIG_DIR: a persistent volume mounted here stores all config + credentials.
# User logs in once inside the container, credentials persist across restarts.
ENV CLAUDE_CONFIG_DIR="/home/claude/.claude-config"
ENV CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"
RUN mkdir -p /home/claude/.claude-config
WORKDIR /workspace

COPY entrypoint.sh /home/claude/entrypoint.sh
USER root
RUN chown ${UID}:${GID} /home/claude/entrypoint.sh && chmod +x /home/claude/entrypoint.sh
USER claude
ENTRYPOINT ["/home/claude/entrypoint.sh"]

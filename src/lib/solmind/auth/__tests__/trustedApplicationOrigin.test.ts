import { describe, expect, it } from "vitest";

import {
  SOLMIND_TRUSTED_APP_ORIGIN_CONFIGURATION_FAILED,
  loadTrustedApplicationOrigin,
  parseTrustedApplicationOrigin,
} from "../trustedApplicationOrigin";

describe("trustedApplicationOrigin", () => {
  it.each([
    ["https://solmind.example", "https://solmind.example"],
    ["https://solmind.example/", "https://solmind.example"],
    ["http://127.0.0.1:3100", "http://127.0.0.1:3100"],
    ["https://solmind.example:443", "https://solmind.example"],
  ])("normalizes the trusted origin %s", (value, expected) => {
    expect(parseTrustedApplicationOrigin(value)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    " https://solmind.example",
    "https://solmind.example ",
    "https://one.example,https://two.example",
    "https://user@solmind.example",
    "https://user:secret@solmind.example",
    "https://solmind.example/path",
    "https://solmind.example/?query=1",
    "https://solmind.example/#fragment",
    "ftp://solmind.example",
    "null",
  ])("rejects unsafe configuration %#", (value) => {
    expect(parseTrustedApplicationOrigin(value)).toBeNull();
  });

  it("loads only the exact server configuration key", () => {
    expect(
      loadTrustedApplicationOrigin({
        SOLMIND_TRUSTED_APP_ORIGIN: "https://solmind.example/",
      }),
    ).toBe("https://solmind.example");
  });

  it("throws one fixed configuration error without reflecting input", () => {
    expect(() =>
      loadTrustedApplicationOrigin({
        SOLMIND_TRUSTED_APP_ORIGIN: "https://secret.example/path",
      }),
    ).toThrow(SOLMIND_TRUSTED_APP_ORIGIN_CONFIGURATION_FAILED);
  });
});

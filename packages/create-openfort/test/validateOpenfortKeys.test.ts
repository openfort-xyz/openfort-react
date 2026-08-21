import { describe, expect, test } from "vitest";

import { validateAppName } from "~/utils/validateAppName.js";
import {
  validateApiEndpoint,
  validateOpenfortPublishableKey,
  validateShieldEncryptionShare,
  validateShieldPublishableKey,
} from "~/utils/validateOpenfortKeys.js";

const uuid = "0f2c3d4e-5a6b-4c8d-9e0f-1a2b3c4d5e6f";

describe("validateOpenfortPublishableKey", () => {
  test("accepts test and live publishable keys", () => {
    expect(validateOpenfortPublishableKey(`pk_test_${uuid}`)).toBeUndefined();
    expect(validateOpenfortPublishableKey(`pk_live_${uuid}`)).toBeUndefined();
  });

  test("rejects a secret key supplied in the publishable slot", () => {
    expect(validateOpenfortPublishableKey(`sk_test_${uuid}`)).toMatch(
      /Openfort Publishable Key is invalid/,
    );
  });

  test("reports a missing value instead of a format problem", () => {
    expect(validateOpenfortPublishableKey("")).toBe(
      "Openfort Publishable Key is required",
    );
  });

  test("treats a lone dash as an explicit skip", () => {
    expect(validateOpenfortPublishableKey("-")).toBeUndefined();
  });
});

describe("validateShieldPublishableKey", () => {
  test("requires a bare UUID", () => {
    expect(validateShieldPublishableKey(uuid)).toBeUndefined();
    expect(validateShieldPublishableKey(`pk_test_${uuid}`)).toMatch(
      /expected UUID format/,
    );
  });
});

describe("validateShieldEncryptionShare", () => {
  test("requires exactly 44 characters", () => {
    expect(validateShieldEncryptionShare("a".repeat(44))).toBeUndefined();
    expect(validateShieldEncryptionShare("a".repeat(43))).toMatch(
      /expected 44 characters/,
    );
  });
});

describe("validateApiEndpoint", () => {
  test("accepts an absolute URL and rejects a bare path", () => {
    expect(validateApiEndpoint("https://api.example.com/session")).toBe(
      undefined,
    );
    expect(validateApiEndpoint("/session")).toBe(
      "API endpoint must be a valid URL",
    );
  });
});

describe("validateAppName", () => {
  test("accepts npm-compatible names, including scoped ones", () => {
    expect(validateAppName("my-app")).toBeUndefined();
    expect(validateAppName("dir/@mono/my_app")).toBeUndefined();
    expect(validateAppName(".")).toBeUndefined();
  });

  test("rejects uppercase and otherwise invalid names", () => {
    expect(validateAppName("MyApp")).toMatch(/lowercase alphanumeric/);
    expect(validateAppName("my app")).toMatch(/lowercase alphanumeric/);
  });
});

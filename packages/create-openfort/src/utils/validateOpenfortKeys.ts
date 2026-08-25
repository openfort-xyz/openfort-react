// Validation patterns for Openfort and Shield keys

const uuidV4Pattern =
  "[\\da-f]{8}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{12}";
const keyPattern = `(test|live)_${uuidV4Pattern}`;
const skRegex = new RegExp(`^sk_${keyPattern}$`);
const pkRegex = new RegExp(`^pk_${keyPattern}$`);
const uuidV4Regex = new RegExp(`^${uuidV4Pattern}$`);
const length44Regex = /^.{44}$/;

type ValidatorOptions = {
  label: string; // e.g. "Openfort Publishable Key"
  required?: boolean; // defaults to true
  regex?: RegExp; // optional format check
  formatHint?: string; // e.g. "expected format: pk_test_... or pk_live_..."
  customCheck?: (value: string) => string | undefined; // optional custom logic
};

const createValidator =
  ({
    label,
    required = true,
    regex,
    formatHint,
    customCheck,
  }: ValidatorOptions) =>
  (value: string): string | undefined => {
    if (value === "-") return undefined; // Allow dash to bypass validation in some cases

    if (required && !value) return `${label} is required`;
    if (regex && value && !regex.test(value))
      return `${label} is invalid${formatHint ? ` (${formatHint})` : ""}`;
    if (customCheck) return customCheck(value);
    return undefined;
  };

export const validateOpenfortPublishableKey = createValidator({
  label: "Openfort Publishable Key",
  regex: pkRegex,
  formatHint: "expected format: pk_test_... or pk_live_...",
});

export const validateOpenfortSecretKey = createValidator({
  label: "Openfort Secret Key",
  regex: skRegex,
  formatHint: "expected format: sk_test_... or sk_live_...",
});

export const validateShieldPublishableKey = createValidator({
  label: "Shield Publishable Key",
  regex: uuidV4Regex,
  formatHint: "expected UUID format",
});

export const validateShieldSecret = createValidator({
  label: "Shield Secret",
  required: true,
});

export const validateShieldEncryptionShare = createValidator({
  label: "Shield Encryption Share",
  regex: length44Regex,
  formatHint: "expected 44 characters",
});

export const validateApiEndpoint = createValidator({
  label: "API endpoint",
  customCheck: (value) => {
    try {
      new URL(value);
      return undefined;
    } catch {
      return "API endpoint must be a valid URL";
    }
  },
});

/**
 * Checks that an encryption-session endpoint is reachable and refusing anonymous
 * callers.
 *
 * A hardened endpoint answers 401 without a bearer token, and the CLI has no
 * user token to offer, so a 401 is the healthy result. Treating it as failure
 * made this check impossible to pass against the backend the CLI itself
 * scaffolds. A 200 means the endpoint mints sessions for anyone who asks.
 */
export const testApiEndpoint = async (endpoint: string): Promise<boolean> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 401 || response.status === 403) return true;

    const body = (await response.json()) as { session?: string };
    return !!body.session;
  } catch {
    return false;
  }
};

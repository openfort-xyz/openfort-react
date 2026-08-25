/** Drops a trailing slash, leaving a lone "/" intact. */
export const removeTrailingSlash = (input: string) =>
  input.replace(/(?<=.)\/$/, "");

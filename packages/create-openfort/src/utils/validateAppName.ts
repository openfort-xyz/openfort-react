import { removeTrailingSlash } from "./removeTrailingSlash.js";

const validationRegExp =
  /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

//Validate a string against allowed package.json names
export const validateAppName = (rawInput: string) => {
  const input = removeTrailingSlash(rawInput);
  const paths = input.split("/");

  // Only the final segment is name-checked below, because `dir/app` is a
  // supported shape. That means a traversal segment or an absolute path would
  // otherwise sail through on the strength of its last component alone and
  // scaffold outside the working directory.
  if (input.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(input)) {
    return "App name must be a relative path, not an absolute one";
  }
  if (paths.includes("..")) {
    return "App name must not contain '..'";
  }

  // If the first part is a @, it's a scoped package
  const indexOfDelimiter = paths.findIndex((p) => p.startsWith("@"));

  let appName = paths[paths.length - 1];
  if (paths.findIndex((p) => p.startsWith("@")) !== -1) {
    appName = paths.slice(indexOfDelimiter).join("/");
  }

  if (input === "." || validationRegExp.test(appName ?? "")) {
    return;
  } else {
    return "App name must consist of only lowercase alphanumeric characters, '-', and '_'";
  }
};

export const MINIMUM_NODE_VERSION = "20.19.0";
export const MINIMUM_NODE_22_VERSION = "22.12.0";
export const SUPPORTED_NODE_RANGE = `^${MINIMUM_NODE_VERSION} || >=${MINIMUM_NODE_22_VERSION}`;

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | undefined;
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseVersion(version: string): ParsedVersion | undefined {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) return undefined;

  const prerelease = match[4];
  if (
    prerelease
      ?.split(".")
      .some(
        (identifier) =>
          /^\d+$/.test(identifier) &&
          identifier.length > 1 &&
          identifier.startsWith("0"),
      )
  ) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }

  return 0;
}

function isSupportedVersion(version: ParsedVersion): boolean {
  if (version.prerelease !== undefined) return false;

  const minimumNode20 = parseVersion(MINIMUM_NODE_VERSION);
  const minimumNode22 = parseVersion(MINIMUM_NODE_22_VERSION);
  if (!minimumNode20 || !minimumNode22) return false;

  if (version.major === 20) {
    return compareVersions(version, minimumNode20) >= 0;
  }

  return compareVersions(version, minimumNode22) >= 0;
}

/** Stops scaffolding before network or filesystem work on unsupported Node runtimes. */
export function assertSupportedNode(version = process.versions.node): void {
  const parsedVersion = parseVersion(version);
  if (parsedVersion && isSupportedVersion(parsedVersion)) return;

  throw new Error(
    `create-openfort requires Node.js ${SUPPORTED_NODE_RANGE}. Current version: ${version}.`,
  );
}

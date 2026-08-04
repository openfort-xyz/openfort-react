#!/usr/bin/env node

/** Synchronizes versioned frontend quickstarts with the templates shipped by create-openfort. */

const { execFileSync } = require('node:child_process');
const {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { isAbsolute, join, relative, resolve, sep } = require('node:path');

const REPO_ROOT = join(__dirname, '..');
const QUICKSTARTS_DIR = join(REPO_ROOT, 'examples/quickstarts');
const TEMPLATES_DIR = join(
  REPO_ROOT,
  'packages/create-openfort/template/openfort-templates'
);
const TEMPLATES_TO_SYNC = [
  'firebase',
  'headless',
  'openfort-ui',
  'solana-headless',
];
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== '--check');

if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument: ${unknownArguments.join(', ')}`);
}

function assertWithin(candidate, parent, label) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  if (
    pathFromParent === '..' ||
    pathFromParent.startsWith(`..${sep}`) ||
    isAbsolute(pathFromParent)
  ) {
    throw new Error(
      `${label} is outside its expected directory: ${candidate}`
    );
  }
}

function generateTemplate(template, templatesDirectory) {
  const sourcePath = join(QUICKSTARTS_DIR, template);
  const targetPath = join(templatesDirectory, template);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source template does not exist: ${sourcePath}`);
  }

  assertWithin(sourcePath, QUICKSTARTS_DIR, 'Source template');
  assertWithin(targetPath, templatesDirectory, 'Generated template');

  rmSync(targetPath, { recursive: true, force: true });
  execFileSync(
    'rsync',
    [
      '-a',
      '--exclude=node_modules',
      '--exclude=dist',
      '--exclude=CHANGELOG.md',
      '--include=.env.example',
      '--exclude=.env*',
      `${sourcePath}/`,
      `${targetPath}/`,
    ],
    { stdio: 'pipe' },
  );

  const dotGitignore = join(targetPath, '.gitignore');
  const npmSafeGitignore = join(targetPath, 'gitignore');
  if (existsSync(dotGitignore)) {
    writeFileSync(npmSafeGitignore, readFileSync(dotGitignore));
    rmSync(dotGitignore);
  }

  const manifestPath = join(targetPath, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.name = `create-openfort-template-${template}`;
  manifest.version = '0.0.0';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      if (entry.name === 'node_modules') return [];

      const relativePath = join(prefix, entry.name);
      if (entry.isDirectory()) {
        return listFiles(join(directory, entry.name), relativePath);
      }
      if (!entry.isFile()) {
        throw new Error(
          `Template contains unsupported filesystem entry: ${relativePath}`
        );
      }
      return [relativePath];
    });
}

function assertDirectoriesMatch(expectedDirectory, actualDirectory, template) {
  if (!existsSync(actualDirectory)) {
    throw new Error(`Shipped template does not exist: ${actualDirectory}`);
  }

  const expectedFiles = listFiles(expectedDirectory);
  const actualFiles = listFiles(actualDirectory);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error(
      `${template} template file list is stale. Run \`pnpm sync-templates\`.`
    );
  }

  for (const relativePath of expectedFiles) {
    const expected = readFileSync(join(expectedDirectory, relativePath));
    const actual = readFileSync(join(actualDirectory, relativePath));
    if (!expected.equals(actual)) {
      throw new Error(
        `${template} template differs at ${relativePath}. Run \`pnpm sync-templates\`.`
      );
    }
  }
}

if (CHECK_ONLY) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'openfort-template-sync-'));
  const expectedTemplates = join(temporaryRoot, 'openfort-templates');
  mkdirSync(expectedTemplates);

  try {
    for (const template of TEMPLATES_TO_SYNC) {
      generateTemplate(template, expectedTemplates);
      assertDirectoriesMatch(
        join(expectedTemplates, template),
        join(TEMPLATES_DIR, template),
        template,
      );
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log('All shipped frontend templates match their quickstarts.');
} else {
  for (const template of TEMPLATES_TO_SYNC) {
    generateTemplate(template, TEMPLATES_DIR);
  }

  console.log('All frontend templates synchronized.');
}

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const expectString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`package.json must declare a non-empty string field: ${field}`);
  }
};

const expectFile = (relativePath, field) => {
  expectString(relativePath, field);
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`${field} points to a missing file: ${relativePath}`);
  }
};

['name', 'displayName', 'publisher', 'version', 'description', 'main'].forEach((field) => {
  expectString(pkg[field], field);
});

if (!pkg.engines || typeof pkg.engines.vscode !== 'string' || pkg.engines.vscode.trim() === '') {
  fail('package.json must declare engines.vscode');
}

expectFile(pkg.main, 'main');
expectFile(pkg.icon, 'icon');

if (!pkg.contributes || !Array.isArray(pkg.contributes.iconThemes) || pkg.contributes.iconThemes.length === 0) {
  fail('package.json must declare contributes.iconThemes with at least one theme');
}

const iconThemeIds = new Set();

for (const [index, theme] of pkg.contributes.iconThemes.entries()) {
  if (!theme || typeof theme !== 'object') {
    fail(`contributes.iconThemes[${index}] must be an object`);
  }

  expectString(theme.label, `contributes.iconThemes[${index}].label`);
  expectString(theme.id, `contributes.iconThemes[${index}].id`);
  expectFile(theme.path, `contributes.iconThemes[${index}].path`);

  if (iconThemeIds.has(theme.id)) {
    fail(`contributes.iconThemes contains duplicate id: ${theme.id}`);
  }
  iconThemeIds.add(theme.id);
}

if (pkg.categories && !pkg.categories.includes('Themes')) {
  fail('package.json categories must include "Themes" for a theme extension');
}

console.log('✓ package.json manifest valid');
console.log(`✓ icon themes declared: ${pkg.contributes.iconThemes.length}`);

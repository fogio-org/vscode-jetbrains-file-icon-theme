#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const themes = pkg.contributes.iconThemes.map((theme) => ({
  id: theme.id,
  label: theme.label,
  file: path.join(root, theme.path),
}));

let totalErrors = 0;

const fail = (message) => {
  console.error(`✗ ${message}`);
  totalErrors++;
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const ensureFileExists = (themeFile, relativePath, field) => {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    fail(`${path.basename(themeFile)}: ${field} must be a non-empty string`);
    return;
  }

  const fullPath = path.resolve(path.dirname(themeFile), relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`${path.basename(themeFile)}: ${field} points to a missing file: ${relativePath}`);
  }
};

const validateIconReferenceMap = (themeFile, sectionName, value, iconDefinitions) => {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    fail(`${path.basename(themeFile)}: ${sectionName} must be an object`);
    return;
  }

  for (const [key, iconId] of Object.entries(value)) {
    if (typeof iconId !== 'string' || iconId.trim() === '') {
      fail(`${path.basename(themeFile)}: ${sectionName}.${key} must reference a non-empty icon id`);
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(iconDefinitions, iconId)) {
      fail(`${path.basename(themeFile)}: ${sectionName}.${key} references unknown icon "${iconId}"`);
    }
  }
};

const validateThemeBody = (themeFile, body, label) => {
  if (!isPlainObject(body)) {
    fail(`${path.basename(themeFile)}: ${label} must be an object`);
    return;
  }

  const iconDefinitions = body.iconDefinitions;
  if (!isPlainObject(iconDefinitions) || Object.keys(iconDefinitions).length === 0) {
    fail(`${path.basename(themeFile)}: ${label}.iconDefinitions must be a non-empty object`);
    return;
  }

  for (const [iconId, definition] of Object.entries(iconDefinitions)) {
    if (!isPlainObject(definition)) {
      fail(`${path.basename(themeFile)}: ${label}.iconDefinitions.${iconId} must be an object`);
      continue;
    }

    if (definition.iconPath !== undefined) {
      ensureFileExists(themeFile, definition.iconPath, `${label}.iconDefinitions.${iconId}.iconPath`);
    }
  }

  for (const key of ['file', 'folder']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].trim() === '') {
        fail(`${path.basename(themeFile)}: ${label}.${key} must be a non-empty string`);
      } else if (!Object.prototype.hasOwnProperty.call(iconDefinitions, body[key])) {
        fail(`${path.basename(themeFile)}: ${label}.${key} references unknown icon "${body[key]}"`);
      }
    }
  }

  validateIconReferenceMap(themeFile, `${label}.fileExtensions`, body.fileExtensions, iconDefinitions);
  validateIconReferenceMap(themeFile, `${label}.fileNames`, body.fileNames, iconDefinitions);
  validateIconReferenceMap(themeFile, `${label}.folderNames`, body.folderNames, iconDefinitions);
  validateIconReferenceMap(themeFile, `${label}.folderNamesExpanded`, body.folderNamesExpanded, iconDefinitions);
  validateIconReferenceMap(themeFile, `${label}.languageIds`, body.languageIds, iconDefinitions);

  if (body.fonts !== undefined) {
    if (!Array.isArray(body.fonts) || body.fonts.length === 0) {
      fail(`${path.basename(themeFile)}: ${label}.fonts must be a non-empty array when present`);
    } else {
      for (const [index, font] of body.fonts.entries()) {
        if (!isPlainObject(font)) {
          fail(`${path.basename(themeFile)}: ${label}.fonts[${index}] must be an object`);
          continue;
        }

        if (!Array.isArray(font.src) || font.src.length === 0) {
          fail(`${path.basename(themeFile)}: ${label}.fonts[${index}].src must be a non-empty array`);
          continue;
        }

        for (const [srcIndex, src] of font.src.entries()) {
          if (!isPlainObject(src)) {
            fail(`${path.basename(themeFile)}: ${label}.fonts[${index}].src[${srcIndex}] must be an object`);
            continue;
          }

          ensureFileExists(themeFile, src.path, `${label}.fonts[${index}].src[${srcIndex}].path`);
        }
      }
    }
  }
};

for (const theme of themes) {
  const raw = fs.readFileSync(theme.file, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`✗ ${path.basename(theme.file)}: invalid strict JSON`);
    console.error(`  - ${error.message}`);
    totalErrors++;
    continue;
  }

  validateThemeBody(theme.file, parsed, 'root');

  if (parsed.light !== undefined) {
    const lightBody = {
      iconDefinitions: parsed.iconDefinitions,
      file: parsed.light.file,
      folder: parsed.light.folder,
      fileExtensions: parsed.light.fileExtensions,
      fileNames: parsed.light.fileNames,
      folderNames: parsed.light.folderNames,
      folderNamesExpanded: parsed.light.folderNamesExpanded,
      languageIds: parsed.light.languageIds,
    };
    validateThemeBody(theme.file, lightBody, 'light');
  }

  if (totalErrors === 0) {
    console.log(
      `✓ ${path.basename(theme.file)} — icons: ${Object.keys(parsed.iconDefinitions || {}).length}, fileExtensions: ${
        Object.keys(parsed.fileExtensions || {}).length
      }, fileNames: ${Object.keys(parsed.fileNames || {}).length}, folderNames: ${
        Object.keys(parsed.folderNames || {}).length
      }`
    );
  }
}

if (totalErrors > 0) {
  console.error(`\n✗ ${totalErrors} error(s)`);
  process.exit(1);
}

console.log('\n✓ all icon themes valid');

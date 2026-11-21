const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const { contributes } = require('../package.json');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'assets', 'img');
const iconImages = new Map();
const scale = 2;
const previewWidth = 581;
const palettes = {
  dark: { background: '#25282b', border: '#3d4147' },
  light: { background: '#f0f0f0', border: '#d6d8db' },
};
const fontFamily = { darwin: 'Menlo', win32: 'Consolas' }[process.platform] || 'DejaVu Sans Mono';
const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]));

// VS Code matches file and folder associations case-insensitively.
const associationKey = (section, label) => section === 'languageIds' ? label : label.toLowerCase();

const variants = contributes.iconThemes.flatMap(({ id, label, path: themePath }) => {
  const file = path.resolve(root, themePath);
  const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
  const name = label.match(/^\|\s*([^|]+?)\s*\|/)?.[1] || label;
  const base = { file, theme, overrides: {}, name, appearance: id.endsWith('-light') ? 'light' : 'dark' };

  return theme.light
    ? [
        { ...base, name: `${name} (dark)` },
        { ...base, name: `${name} (light)`, appearance: 'light', overrides: theme.light },
      ]
    : [base];
});

function iconPaths(section) {
  return variants.map(({ file, theme, overrides, appearance }) => {
    const paths = new Map();
    const addIcon = (label, iconId) => {
      const iconPath = theme.iconDefinitions[iconId]?.iconPath;
      if (!iconPath) {
        throw new Error(`${path.basename(file)}: missing iconPath for "${iconId}" (${label})`);
      }
      paths.set(associationKey(section, label), {
        label,
        iconPath: path.resolve(path.dirname(file), iconPath),
      });
    };

    if (section === 'goTests') {
      // The extension adds exact file-name overrides for workspace Go tests when enabled.
      const goIcon = overrides.fileExtensions?.go ?? theme.fileExtensions.go;
      const testIcon = appearance === 'light' ? 'file_go_test_light' : 'file_go_test';
      addIcon('file.go', overrides.fileNames?.['file.go'] ?? theme.fileNames?.['file.go'] ?? goIcon);
      addIcon('file_test.go (off)', goIcon);
      addIcon('file_test.go (on)', testIcon);
      return paths;
    }

    const associations = [...Object.entries(theme[section] || {}), ...Object.entries(overrides[section] || {})];
    for (const [label, iconId] of associations) {
      // Workspace Go test names can be written to the theme JSON by the extension.
      if (section === 'fileNames' && label.endsWith('_test.go')) continue;
      addIcon(section === 'fileExtensions' ? `.${label}` : label, iconId);
    }
    if (section === 'folderNames') addIcon('(default folder)', overrides.folder ?? theme.folder);
    if (section === 'fileNames') addIcon('(default file)', overrides.file ?? theme.file);
    return paths;
  });
}

function groupVariants(maps, keys) {
  const groups = new Map();
  for (const [index, { name, appearance }] of variants.entries()) {
    const paths = keys.map((key) => maps[index].get(key)?.iconPath);
    const key = JSON.stringify([appearance, paths]);
    if (!groups.has(key)) groups.set(key, { names: [], appearance, paths });
    groups.get(key).names.push(name);
  }
  return [...groups.values()].sort((a, b) => a.appearance.localeCompare(b.appearance, 'en'));
}

function iconImage(file, x, y) {
  if (!iconImages.has(file)) {
    const icon = new Resvg(fs.readFileSync(file), {
      font: { loadSystemFonts: false },
      fitTo: { mode: 'width', value: 16 * scale },
    });
    iconImages.set(file, icon.render().asPng().toString('base64'));
  }
  return `<image href="data:image/png;base64,${iconImages.get(file)}" x="${x}" y="${y}" width="16" height="16"/>`;
}

function swatch(appearance, x, y) {
  const { background, border } = palettes[appearance];
  return `<rect x="${x}" y="${y}" width="24" height="22" rx="4" fill="${background}" stroke="${border}"/>`;
}

function render(section, columns) {
  const maps = iconPaths(section);
  const displayLabels = new Map();
  for (const map of maps) {
    for (const [key, { label }] of map) {
      if (!displayLabels.has(key) || label === key) displayLabels.set(key, label);
    }
  }
  const keys = [...displayLabels.keys()];
  if (section !== 'goTests') keys.sort();
  if (keys.length === 0) throw new Error(`No entries for ${section}`);

  const labels = keys.map((key) => displayLabels.get(key));
  const groups = groupVariants(maps, keys);
  const padding = 16;
  const rowHeight = 27;
  const columnWidth = (previewWidth - padding * 2) / columns;
  const swatchesWidth = groups.length * 30;
  const elements = [];
  let legendX = padding;
  let legendY = 12;
  for (const { names, appearance } of groups) {
    const label = names.slice().reverse().join(' + ');
    const itemWidth = 40 + label.length * 9;
    if (legendX > padding && legendX + itemWidth > previewWidth - padding) {
      legendX = padding;
      legendY += rowHeight;
    }
    elements.push(swatch(appearance, legendX, legendY));
    elements.push(`<text x="${legendX + 32}" y="${legendY + 16}">${escapeXml(label)}</text>`);
    legendX += itemWidth;
  }
  const dividerY = legendY + 33;
  elements.push(`<path d="M${padding} ${dividerY}H${previewWidth - padding}" stroke="#d6d8db"/>`);

  let row = 0;
  let column = 0;
  for (const [index, label] of labels.entries()) {
    // Let long names span the full row so each preview keeps the same font size.
    const span = Math.min(columns, Math.ceil((swatchesWidth + label.length * 9 + 12) / columnWidth));
    if (column + span > columns) {
      row++;
      column = 0;
    }
    const columnX = padding + column * columnWidth;
    const y = dividerY + 7 + row * rowHeight;
    for (const [groupIndex, { appearance, paths }] of groups.entries()) {
      const x = columnX + groupIndex * 30;
      const file = paths[index];
      if (file) elements.push(swatch(appearance, x, y), iconImage(file, x + 4, y + 3));
    }
    elements.push(`<text x="${columnX + swatchesWidth}" y="${y + 16}">${escapeXml(label)}</text>`);
    column += span;
  }

  const height = dividerY + 13 + (row + 1) * rowHeight;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="${height}">
    <rect width="${previewWidth}" height="${height}" rx="8" fill="#fafafb"/>
    <g font-family="monospace" font-size="14" fill="#25282b">${elements.join('')}</g>
  </svg>`;
  return new Resvg(svg, {
    font: { monospaceFamily: fontFamily, defaultFontFamily: fontFamily },
    fitTo: { mode: 'zoom', value: scale },
  }).render().asPng();
}

const previews = [
  ['preview_folders.png', 'folderNames', 2],
  ['preview_file_extensions.png', 'fileExtensions', 2],
  ['preview_file_names.png', 'fileNames', 2],
  ['preview_language_ids.png', 'languageIds', 2],
  ['preview_go_test_files.png', 'goTests', 1],
];

const images = previews.map(([name, section, columns]) => [name, render(section, columns)]);
for (const [name, png] of images) {
  fs.writeFileSync(path.join(outputDir, name), png);
  console.log(`Generated assets/img/${name}`);
}

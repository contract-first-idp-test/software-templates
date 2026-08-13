#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const releaseSource = fs.readFileSync(path.join(root, 'release.yaml'), 'utf8');
const value = key => {
  const match = releaseSource.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'));
  if (!match) throw new Error(`release.yaml is missing ${key}`);
  return match[1].trim();
};
const release = {
  version: value('version'),
  requires: {
    platformComponents: value('platformComponents'),
    developerCharts: value('developerCharts'),
  },
};
const templates = [
  'templates/domain/template.yaml',
  'templates/system/template.yaml',
  'templates/system/activation.yaml',
  'templates/api/template.yaml',
  'templates/component/template.yaml',
  'templates/resource/template.yaml',
  'templates/component/promotion.yaml',
];

const block = [
  '    - id: validateCompatibility',
  '      name: Validate platform compatibility',
  '      action: contract-first-idp:validate-compatibility',
  '      input:',
  `        releaseVersion: ${JSON.stringify(release.version)}`,
  '        requires:',
  `          platformComponents: ${JSON.stringify(release.requires.platformComponents)}`,
  `          developerCharts: ${JSON.stringify(release.requires.developerCharts)}`,
  '        selected:',
  '          platformComponents: ${{ steps.fetchTarget.output.entity.spec.platform.distribution.version }}',
  '          developerCharts: ${{ steps.fetchTarget.output.entity.spec.platform.dependencies.developerCharts.version }}',
].join('\n');

let stale = false;
for (const relative of templates) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const generated = source.replace(
    /    - id: validateCompatibility\n[\s\S]*?(?=\n    - id: )/,
    block,
  );
  if (generated === source && !source.includes(block)) {
    throw new Error(`${relative} has no generated compatibility step`);
  }
  if (generated !== source) {
    stale = true;
    if (process.argv.includes('--check')) {
      console.error(`${relative} is stale; run node scripts/generate-compatibility.js`);
    } else {
      fs.writeFileSync(file, generated);
    }
  }
}

if (process.argv.includes('--check') && stale) process.exit(1);

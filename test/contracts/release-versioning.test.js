const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const semver = require('semver');
const {repositoryRoot: root} = require('../helpers/paths');

const release = YAML.parse(fs.readFileSync(path.join(root, 'release.yaml'), 'utf8'));

describe('software-templates release policy', () => {
  test('declares independent platform and chart compatibility ranges', () => {
    expect(release).toEqual({
      version: '1.0.0',
      requires: {
        platformComponents: '>=1.0.0 <2.0.0',
        developerCharts: '>=1.0.0 <2.0.0',
      },
    });
    expect(semver.valid(release.version)).toBe(release.version);
    for (const range of Object.values(release.requires)) {
      expect(semver.validRange(range)).not.toBeNull();
    }
  });

  test('models an independent template patch with unchanged requirements', () => {
    const patch = {version: '1.0.1', requires: {...release.requires}};
    expect(patch.requires).toEqual(release.requires);
    expect(semver.satisfies('1.0.0', patch.requires.platformComponents)).toBe(true);
    expect(semver.satisfies('1.0.1', patch.requires.developerCharts)).toBe(true);
  });

  test('allows a hypothetical minor to raise dependency floors', () => {
    const minor = {
      version: '1.1.0',
      requires: {
        platformComponents: '>=1.1.0 <2.0.0',
        developerCharts: '>=1.1.0 <2.0.0',
      },
    };
    expect(semver.satisfies('1.0.9', minor.requires.platformComponents)).toBe(false);
    expect(semver.satisfies('1.1.0', minor.requires.platformComponents)).toBe(true);
    expect(semver.satisfies('1.1.0', minor.requires.developerCharts)).toBe(true);
  });

  test('does not inject runtime compatibility actions into golden paths', () => {
    for (const file of [
      'templates/domain/template.yaml', 'templates/system/template.yaml',
      'templates/system/activation.yaml', 'templates/api/template.yaml',
      'templates/component/template.yaml', 'templates/resource/template.yaml',
      'templates/component/promotion.yaml',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .not.toContain('contract-first-idp:validate-compatibility');
    }
  });
});

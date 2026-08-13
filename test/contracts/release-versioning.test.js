const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const YAML = require('yaml');
const semver = require('semver');
const {repositoryRoot: root} = require('../helpers/paths');

const templates = [
  'templates/domain/template.yaml',
  'templates/system/template.yaml',
  'templates/system/activation.yaml',
  'templates/api/template.yaml',
  'templates/component/template.yaml',
  'templates/resource/template.yaml',
  'templates/component/promotion.yaml',
];
const release = YAML.parse(fs.readFileSync(path.join(root, 'release.yaml'), 'utf8'));

describe('software-templates release compatibility', () => {
  test('declares independent platform and chart requirements', () => {
    expect(release).toEqual({
      version: '1.1.1',
      requires: {
        platformComponents: '>=1.1.0 <2.0.0',
        developerCharts: '>=1.0.0 <1.1.0',
      },
    });
    expect(semver.valid(release.version)).toBe(release.version);
    for (const range of Object.values(release.requires)) {
      expect(semver.validRange(range)).toBe(range);
    }
  });

  test.each(templates)('%s validates before workspace or external mutation', file => {
    const document = YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const steps = document.spec.steps;
    const validation = steps.find(step => step.id === 'validateCompatibility');
    expect(validation).toMatchObject({
      action: 'contract-first-idp:validate-compatibility',
      input: {
        releaseVersion: release.version,
        requires: release.requires,
        selected: {
          platformComponents:
            '${{ steps.fetchTarget.output.entity.spec.platform.distribution.version }}',
          developerCharts:
            '${{ steps.fetchTarget.output.entity.spec.platform.dependencies.developerCharts.version }}',
        },
      },
    });
    expect(steps.indexOf(validation)).toBeGreaterThan(
      steps.findIndex(step => step.id === 'fetchTarget'));
    expect(steps.indexOf(validation)).toBeLessThan(steps.findIndex(step =>
      step.action.startsWith('fetch:') || step.action.startsWith('publish:')));
    expect(validation).not.toHaveProperty('input.expression');
  });

  test('release.yaml is authoritative and generated template steps are current', () => {
    const result = spawnSync('node', ['scripts/generate-compatibility.js', '--check'], {
      cwd: root, encoding: 'utf8',
    });
    expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ''});
  });

  test('patches preserve ranges and compatible chart patches need no template release', () => {
    const templatePatch = {version: '1.1.9', requires: {...release.requires}};
    expect(templatePatch.requires).toEqual(release.requires);
    expect(semver.satisfies('1.0.9', templatePatch.requires.developerCharts)).toBe(true);
    expect(semver.satisfies('1.1.9', templatePatch.requires.platformComponents)).toBe(true);
  });

  test('hypothetical minor evolution may raise dependency floors', () => {
    const platform = '1.2.0';
    const chart = {
      version: '1.1.0', requires: {platformComponents: '>=1.2.0 <2.0.0'},
    };
    const template = {
      version: '1.2.0',
      requires: {
        platformComponents: '>=1.2.0 <2.0.0', developerCharts: '>=1.1.0 <1.2.0',
      },
    };
    expect(semver.satisfies(platform, chart.requires.platformComponents)).toBe(true);
    expect(semver.satisfies(platform, template.requires.platformComponents)).toBe(true);
    expect(semver.satisfies(chart.version, template.requires.developerCharts)).toBe(true);
    expect(semver.satisfies('1.1.9', chart.requires.platformComponents)).toBe(false);
  });
});

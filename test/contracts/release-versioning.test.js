const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const jsonata = require('jsonata');
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
      version: '1.1.0',
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
    expect(validation).toMatchObject({action: 'roadiehq:utils:jsonata'});
    expect(steps.indexOf(validation)).toBeGreaterThan(
      steps.findIndex(step => step.id === 'fetchTarget'));
    expect(steps.indexOf(validation)).toBeLessThan(steps.findIndex(step =>
      step.action.startsWith('fetch:') || step.action.startsWith('publish:')));
    expect(validation.input.expression).toContain(release.requires.platformComponents);
    expect(validation.input.expression).toContain(release.requires.developerCharts);
  });

  test('current known-good target is accepted', async () => {
    const template = YAML.parse(fs.readFileSync(path.join(root, templates[0]), 'utf8'));
    const expression = template.spec.steps.find(
      step => step.id === 'validateCompatibility').input.expression;
    await expect(jsonata(expression).evaluate({
      platformVersion: '1.1.0', developerChartsVersion: '1.0.1',
    })).resolves.toEqual({compatible: true});
  });

  test.each([
    ['platform-components', {platformVersion: '1.0.9', developerChartsVersion: '1.0.1'}],
    ['developer-charts', {platformVersion: '1.1.0', developerChartsVersion: '1.1.0'}],
  ])('rejects incompatible %s before generation', async (dependency, actual) => {
    const template = YAML.parse(fs.readFileSync(path.join(root, templates[0]), 'utf8'));
    const expression = template.spec.steps.find(
      step => step.id === 'validateCompatibility').input.expression;
    let failure;
    try {
      await jsonata(expression).evaluate(actual);
    } catch (error) {
      failure = error;
    }
    expect(failure?.message).toMatch(
      new RegExp(`requires ${dependency}.*selected Platform Target provides ${dependency}`),
    );
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

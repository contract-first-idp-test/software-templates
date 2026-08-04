const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {
  API_VERSION_PATTERN,
  RELEASE_VERSION_PATTERN,
} = require('../utils/releaseVersion');
const {
  applyRegistryFixtureOverrides,
  rewriteCompatibleActions,
} = require('../utils/dryRun');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const supportedActions = new Set([
  'catalog:fetch',
  'catalog:register',
  'debug:log',
  'fetch:template',
  'fetch:plain:file',
  'publish:github',
  'publish:github:pull-request',
  'github:webhook',
  'roadiehq:utils:jsonata',
  'roadiehq:utils:fs:write',
  'roadiehq:utils:fs:parse',
  'roadiehq:utils:serialize:yaml',
]);

function localDependencies(templatePath, value) {
  if (Array.isArray(value)) return value.flatMap(child =>
    localDependencies(templatePath, child));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const dependency = key === 'url' && typeof child === 'string' &&
      (child.startsWith('./') || child.startsWith('../'))
      ? [path.resolve(path.dirname(templatePath), child)]
      : [];
    return [...dependency, ...localDependencies(templatePath, child)];
  });
}

describe('registered template contracts', () => {
  const catalog = YAML.parse(read('catalog-info.yaml'));
  const targets = catalog.spec.targets;

  it('parses the catalog and every registered template', () => {
    expect(catalog.kind).toBe('Location');
    expect(read('catalog-info.yaml')).not.toContain('test/fixtures/');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const templatePath = path.resolve(root, target);
      expect(fs.existsSync(templatePath)).toBe(true);
      const template = YAML.parse(fs.readFileSync(templatePath, 'utf8'));
      expect(template.kind).toBe('Template');
      expect(template.metadata.annotations['backstage-gitea.io/github-compatible'])
        .toBe('true');
    }
  });

  it('uses supported actions and existing local skeleton dependencies', () => {
    for (const target of targets) {
      const templatePath = path.resolve(root, target);
      const template = YAML.parse(fs.readFileSync(templatePath, 'utf8'));
      for (const step of template.spec.steps || []) {
        expect(supportedActions).toContain(step.action);
      }
      for (const dependency of localDependencies(templatePath, template)) {
        const stablePrefix = dependency.includes('${{')
          ? dependency.slice(0, dependency.indexOf('${{'))
          : dependency;
        expect({dependency, exists: fs.existsSync(stablePrefix)})
          .toEqual({dependency, exists: true});
      }
    }
  });

  it('uses GitHub permission slugs for generated team access', () => {
    for (const name of ['domain', 'system', 'api', 'component', 'resource']) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      const publish = template.spec.steps.find(step => step.action === 'publish:github');
      expect(publish).toBeDefined();
      for (const collaborator of publish.input.collaborators) {
        expect(['push', 'pull']).toContain(collaborator.access);
      }
    }
  });

  it('immediately registers every generated root catalog entity', () => {
    for (const name of ['domain', 'system', 'api', 'component', 'resource']) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      const registration = template.spec.steps.filter(step =>
        step.action === 'catalog:register');
      expect(registration).toHaveLength(1);
      expect(registration[0].input).toMatchObject({
        catalogInfoPath: 'catalog-info.yaml',
      });
      const publish = template.spec.steps.find(step => step.action === 'publish:github');
      expect(publish.input.sourcePath).toMatch(/-repo$/);
    }
  });

  it('preserves the existing Gitea-compatible action transformation', () => {
    const template = YAML.parse(read('templates/domain/template.yaml'));
    const transformed = rewriteCompatibleActions(template);
    expect(transformed.spec.steps.find(step => step.id === 'publish').action)
      .toBe('publish:gitea');
    expect(transformed.spec.steps.find(step => step.id === 'platformPr').action)
      .toBe('publish:gitea:pull-request');
    expect(transformed.spec.steps.find(step => step.id === 'fetchTarget').action)
      .toBe('catalog:fetch');
  });

  it('keeps live dry runs hermetic with consumed Registry fixture content', () => {
    const template = YAML.parse(read('templates/component/template.yaml'));
    const transformed = applyRegistryFixtureOverrides(template, [
      'openapi: 3.1.0',
    ]);
    const fetch = transformed.spec.steps.find(step =>
      step.id === 'fetchConsumedContracts');
    expect(fetch).toMatchObject({
      action: 'roadiehq:utils:fs:write',
      input: {
        path: 'consumed-contracts/${{ each.key }}-${{ each.value.contract_file }}',
        content: '${{ parameters.__registryFixtures[each.key] }}',
      },
    });
    expect(template.spec.steps.find(step => step.id === 'fetchConsumedContracts').action)
      .toBe('fetch:plain:file');
  });

  it('keeps stable user-facing identity parameters and generated annotations', () => {
    const expectedParameters = {
      domain: ['organization', 'domainName', 'groupId', 'platformTarget', 'environments', 'buildEnvironment'],
      system: ['systemName', 'domainRef'],
      api: ['apiId', 'systemRef'],
      component: ['componentName', 'systemRef', 'implementationProfile'],
      resource: ['profile', 'resourceName', 'systemRef'],
    };
    for (const [name, fields] of Object.entries(expectedParameters)) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      const properties = Object.assign({}, ...template.spec.parameters
        .map(section => section.properties || {}));
      for (const field of fields) expect(properties).toHaveProperty(field);
    }

    for (const relative of [
      'skeletons/domain/base/catalog-info.yaml',
      'skeletons/system/base/catalog-info.yaml',
      'skeletons/api/catalog/catalog-info.yaml',
      'skeletons/component/base/catalog-info.yaml',
      'skeletons/resource/implementations/postgresql/resource-repo/catalog-info.yaml',
    ]) {
      const source = read(relative);
      expect(source).toContain('contract-first-idp.github.io/scm-provider');
      expect(source).toContain('contract-first-idp.github.io/scm-host');
      expect(source).toContain('contract-first-idp.github.io/domain-org');
      expect(source).toContain('contract-first-idp.github.io/domain-repo');
    }
  });

  it('accepts intended release and API versions and rejects unsafe values', () => {
    for (const value of ['v1', 'v2.1', 'v2.1.3', 'v2.1.3-rc.1']) {
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(true);
      expect(API_VERSION_PATTERN.test(value)).toBe(true);
    }
    for (const value of ['latest', 'a'.repeat(40)]) {
      expect(API_VERSION_PATTERN.test(value)).toBe(true);
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(false);
    }
    for (const value of ['', 'main', 'v1/unsafe', 'latest-ish', 'abc123']) {
      expect(API_VERSION_PATTERN.test(value)).toBe(false);
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(false);
    }
  });

  it('does not generate registry credentials or use the forbidden internal registry', () => {
    const sources = fs.readdirSync(path.join(root, 'skeletons'), {recursive: true})
      .filter(relative => fs.statSync(path.join(root, 'skeletons', relative)).isFile())
      .map(relative => fs.readFileSync(path.join(root, 'skeletons', relative), 'utf8'))
      .join('\n');
    expect(sources).not.toContain('image-registry.openshift-image-registry.svc:5000');
    expect(sources).not.toMatch(/\.dockerconfigjson|clientSecret|BEGIN PRIVATE KEY/);
  });
});

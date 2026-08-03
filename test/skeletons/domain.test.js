const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const {renderDirectory} = require('../utils/profileRenderer');

const root = path.resolve(__dirname, '../..');

test('Domain skeleton renders a parseable nonstandard lifecycle', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-skeleton-'));
  try {
    await renderDirectory({
      source: path.join(root, 'skeletons/domain/base'),
      destination,
      values: {
        organization: 'retail-team',
        domainName: 'retail',
        repositoryName: 'retail-domain',
        title: 'Retail',
        description: 'Retail domain',
        groupId: 'com.example',
        scmProvider: 'github',
        tenantScmHost: 'tenant.example',
        platformTarget: 'resource:default/workshop',
        environments: [
          {name: 'sandbox', namespaceSuffix: '-build'},
          {name: 'stage', namespaceSuffix: '-preprod'},
          {name: 'production', namespaceSuffix: ''},
        ],
        buildEnvironment: 'sandbox',
      },
    });
    const catalog = YAML.parse(await fs.readFile(
      path.join(destination, 'catalog-info.yaml'), 'utf8'));
    expect(catalog.spec.environments.order).toEqual(['sandbox', 'stage', 'production']);
    expect(catalog.spec.environments.build).toBe('sandbox');
    expect(catalog.spec.environments.definitions.production.namespaceSuffix).toBe('');
    expect(catalog.spec.platformTarget).toBe('resource:default/workshop');
    expect(catalog.spec).not.toHaveProperty('schemaRegistry');
    expect(catalog.spec.environments.definitions.stage).not.toHaveProperty('clusterDomain');
    expect(catalog.metadata.annotations['contract-first-idp.github.io/scm-provider']).toBe('github');
    expect(await fs.readFile(path.join(destination, 'README.md'), 'utf8'))
      .not.toContain('${{');
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});

test('platform admission skeleton renders exactly three trusted repositories', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-admission-'));
  try {
    await renderDirectory({
      source: path.join(root, 'skeletons/domain/platform-admission'),
      destination,
      values: {
        domainName: 'retail',
        organization: 'retail-team',
        repositoryName: 'retail-domain',
        tenantScmHost: 'github.com',
        platformRepositoryHost: 'github.com',
        platformRepositoryOrganization: 'contract-first-idp',
        platformRepositoryName: 'platform-components',
        platformRepositoryRevision: 'v1.0.0',
        platformTargetValuesPath: 'targets/workshop/catalog-info.yaml',
        developerChartsRepositoryUrl:
          'https://github.com/contract-first-idp/developer-charts.git',
        developerChartsRevision: 'v1.0.0',
        argocdNamespace: 'openshift-gitops',
        destinationServer: 'https://kubernetes.default.svc',
      },
    });
    const project = YAML.parse(await fs.readFile(path.join(destination, 'project.yaml'), 'utf8'));
    expect(project.spec.sourceRepos).toEqual([
      'https://github.com/contract-first-idp/developer-charts.git',
      'https://github.com/retail-team/retail-domain.git',
      'https://github.com/contract-first-idp/platform-components.git',
    ]);
    const application = YAML.parse(await fs.readFile(
      path.join(destination, 'application.yaml'), 'utf8'));
    expect(application.spec.sources).toHaveLength(3);
    expect(application.spec.sources[0].helm.valueFiles).toEqual([
      '$platform/targets/workshop/catalog-info.yaml',
      '$domain/catalog-info.yaml',
    ]);
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});

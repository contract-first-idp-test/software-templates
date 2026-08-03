const {getTestConfig} = require('../utils/env');
const {runDryRun} = require('../utils/dryRun');
const {parseYamlFile} = require('../utils/assertions');

test('live Backstage dry-run creates a Domain repository', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/domain',
    fixturePath: 'test/fixtures/basic/domain.yaml',
    writeOutput: config.writeOutput,
  });
  const domain = parseYamlFile(result, 'domain-repo/catalog-info.yaml');
  expect(domain.kind).toBe('Domain');
  expect(domain.spec.environments).toMatchObject({
    order: ['dev', 'test', 'prod'],
    build: 'dev',
  });
  expect(domain.spec.environments.definitions.prod.namespaceSuffix).toBe('');
  expect(domain.spec.platformTarget).toBe('resource:default/workshop');
  expect(domain.spec).not.toHaveProperty('schemaRegistry');
  expect(result.files.filter(file => file.path.startsWith('domain-repo/environments/')))
    .toHaveLength(0);
  expect(result.files.map(file => file.path)).toEqual(expect.arrayContaining([
    'platform-pr/tenants/cf-idp-tenant/project.yaml',
    'platform-pr/tenants/cf-idp-tenant/application.yaml',
  ]));
}, 15000);

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const {XMLValidator} = require('fast-xml-parser');
const {renderDirectory} = require('../utils/profileRenderer');

const root = path.resolve(__dirname, '../..');

test('API skeleton renders valid XML and catalog YAML', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'api-skeleton-'));
  try {
    const common = {
      api_id: 'orders',
      apiId: 'orders',
      description: 'Orders API',
      registryGroupId: 'com.example.orders',
      registryArtifactId: 'orders',
      schemaRegistryApiUrl: 'https://registry.example/apis/registry/v3',
      owner: 'group:default/retail-contributors',
      systemRef: 'system:retail/orders',
      scmProvider: 'github',
      scmHost: 'tenant.example',
      domainOrg: 'retail-team',
      domainRepo: 'retail-domain',
      repositoryName: 'orders-api',
    };
    await renderDirectory({
      source: path.join(root, 'skeletons/api/base'),
      destination: path.join(destination, 'base'),
      values: common,
    });
    await renderDirectory({
      source: path.join(root, 'skeletons/api/catalog'),
      destination: path.join(destination, 'catalog'),
      values: common,
    });
    const pom = await fs.readFile(path.join(destination, 'base/pom.xml'), 'utf8');
    expect(XMLValidator.validate(pom)).toBe(true);
    expect(pom).not.toContain('${{');
    const catalog = YAML.parse(await fs.readFile(
      path.join(destination, 'catalog/catalog-info.yaml'), 'utf8'));
    expect(catalog.metadata.annotations).toMatchObject({
      'contract-first-idp.github.io/scm-provider': 'github',
      'contract-first-idp.github.io/schema-registry-group-id': 'com.example.orders',
      'contract-first-idp.github.io/schema-registry-artifact-id': 'orders',
    });
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});

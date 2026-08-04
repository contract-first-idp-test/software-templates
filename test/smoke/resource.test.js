const {getTestConfig} = require('../utils/env');
const {runDryRun} = require('../utils/dryRun');
const {expectFile, parseYamlFile} = require('../utils/assertions');

test('live Backstage dry-run creates a PostgreSQL Resource', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/resource',
    fixturePath: 'test/fixtures/inputs/basic/resource.yaml',
    domainContractPath: 'test/fixtures/scenarios/bookinfo/domain.yaml',
    writeOutput: config.writeOutput,
  });
  expect(parseYamlFile(result, 'resource-repo/catalog-info.yaml').kind).toBe('Resource');
  expectFile(result, 'system-pr/resources/postgresql/reviews-db/values.yaml');
  expectFile(result, 'system-pr/resources/postgresql/reviews-db/environments/dev.yaml');
}, 15000);

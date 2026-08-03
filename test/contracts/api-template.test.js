const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const root = path.resolve(__dirname, '../..');
const template = YAML.parse(fs.readFileSync(
  path.join(root, 'templates/api/template.yaml'),
  'utf8',
));
const source = fs.readFileSync(path.join(root, 'templates/api/template.yaml'), 'utf8');

test('API template consumes runtime configuration from the target entity', () => {
  expect(template.spec.steps.find(step => step.id === 'fetchTargetValues')).toBeUndefined();
  expect(template.spec.steps.find(step => step.id === 'parseTargetValues')).toBeUndefined();
  expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.schemaRegistry.apiUrl');
  expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.cluster.routerDomain');
  expect(source).not.toContain('domain-values.yaml');
});

test('API template stages the selected document without governing it', () => {
  expect(template.spec.steps.find(step => step.id === 'prepareSpecification')).toMatchObject({
    action: 'roadiehq:utils:jsonata',
    input: {
      data: {
        dataUrl: '${{ parameters.specificationFile }}',
        apiId: '${{ parameters.apiId }}',
        description: '${{ parameters.description }}',
      },
      expression: expect.any(String),
    },
  });
  expect(template.spec.steps.find(step => step.id === 'writeSpecification')).toMatchObject({
    action: 'roadiehq:utils:fs:write',
    input: {
      path: 'api-repo/specification.yaml',
      content: '${{ steps.prepareSpecification.output.result.content }}',
      preserveFormatting: true,
    },
  });
  for (const removed of [
    'writeUploadedSpecification', 'parseSpecification',
    'governSpecification', 'serializeSpecification',
  ]) expect(template.spec.steps.find(step => step.id === removed)).toBeUndefined();
});

test('API template delegates all contract governance to Spectral', () => {
  expect(source).not.toContain('$assert');
  expect(source).not.toContain('OpenAPI version must');
  expect(source).not.toContain('info.version must');
  expect(source).not.toContain('paths must be');
  expect(source).not.toContain('governSpecification');
  expect(source).not.toContain('parseSpecification');
});

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {validateDomainEnvironmentContract} = require('../utils/domainContract');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const fixture = () => YAML.parse(read('test/fixtures/nonstandard-lifecycle/domain.yaml'));

describe('portable Domain and admission contracts', () => {
  it('accepts a consistent nonstandard lifecycle without cluster endpoints', () => {
    expect(() => validateDomainEnvironmentContract(fixture())).not.toThrow();
  });

  it.each([
    ['duplicate order', domain => domain.spec.environments.order.push('stage')],
    ['missing definition', domain => delete domain.spec.environments.definitions.stage],
    ['build not first', domain => { domain.spec.environments.build = 'stage'; }],
    ['tenant cluster domain', domain => {
      domain.spec.environments.definitions.stage.clusterDomain = 'apps.example';
    }],
  ])('rejects %s', (_name, mutate) => {
    const domain = fixture();
    mutate(domain);
    expect(() => validateDomainEnvironmentContract(domain)).toThrow();
  });

  it('selects typed platform targets and creates one independent admission directory', () => {
    const template = YAML.parse(read('templates/domain/template.yaml'));
    const properties = template.spec.parameters[0].properties;
    expect(properties.platformTarget['ui:options'].catalogFilter).toEqual([
      {kind: 'Resource', 'spec.type': 'contract-first-idp-target'},
    ]);
    expect(template.spec.steps.filter(step => step.id === 'renderAdmission')).toHaveLength(1);
    expect(template.spec.steps.find(step => step.id === 'fetchTargetValues')).toBeUndefined();
    expect(template.spec.steps.find(step => step.id === 'parseTargetValues')).toBeUndefined();
    expect(template.spec.steps.some(step => step.action?.startsWith('roadiehq:'))).toBe(false);
    expect(template.spec.steps.find(step => step.id === 'renderAdmission').input.targetPath)
      .toContain('spec.platform.tenantAdmission.path');
    expect(template.spec.steps.find(step => step.id === 'platformPr').action)
      .toBe('publish:github:pull-request');
    expect(template.spec.steps.find(step => step.id === 'platformPr').input.targetBranchName)
      .toContain('spec.platform.tenantAdmission.branch');
  });

  it('generates a self-contained exact three-repository admission pair', () => {
    const project = read('skeletons/domain/platform-admission/project.yaml');
    const application = read('skeletons/domain/platform-admission/application.yaml');
    expect((project.match(/^    - /gm) || []).length).toBeGreaterThanOrEqual(3);
    expect(project).toContain('${{ values.developerChartsRepositoryUrl }}');
    expect(project).toContain('${{ values.repositoryName }}.git');
    expect(project).toContain('${{ values.platformRepositoryName }}.git');
    expect(application).toContain('$domain/catalog-info.yaml');
    expect(application).toContain('$platform/${{ values.platformTargetValuesPath }}');
    expect(application.indexOf('$platform/${{ values.platformTargetValuesPath }}'))
      .toBeLessThan(application.indexOf('$domain/catalog-info.yaml'));
    expect(application).toContain('targetRevision: ${{ values.developerChartsRevision }}');
  });
});

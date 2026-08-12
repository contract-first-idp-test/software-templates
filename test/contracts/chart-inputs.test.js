const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('template-to-chart inputs', () => {
  it('uses the target catalog entity as the single platform contract', () => {
    for (const name of ['domain', 'api', 'component']) {
      const templateSource = read(`templates/${name}/template.yaml`);
      expect(templateSource).toContain('steps.fetchTarget.output.entity.spec.platform');
      expect(templateSource).not.toContain('domain-values.yaml');
      expect(templateSource).not.toContain('fetchTargetValues');
      expect(templateSource).not.toContain('parseTargetValues');
    }
    expect(read('templates/domain/template.yaml'))
      .toContain('roadiehq:utils:jsonata');
  });

  it('keeps tenant policy portable and target values trusted', () => {
    const catalog = read('skeletons/domain/base/catalog-info.yaml');
    for (const forbidden of [
      'schemaRegistry', 'clusterDomain', 'quay', 'routerDomain', 'argocd',
      'sccClusterRoleName', 'developer-charts',
    ]) expect(catalog).not.toContain(forbidden);
    expect(catalog).toContain('platformTarget: ${{ values.platformTarget }}');

    const application = read('skeletons/domain/platform-admission/application.yaml');
    expect(application).toContain('path: charts/domain/environment');
    expect(application).toContain('targetRevision: ${{ values.developerChartsRevision }}');
    expect(application).toContain('$domain/catalog-info.yaml');
    expect(application).toContain('$platform/${{ values.platformTargetValuesPath }}');
    expect(application.indexOf('$platform/${{ values.platformTargetValuesPath }}'))
      .toBeLessThan(application.indexOf('$domain/catalog-info.yaml'));
  });

  it('generates immutable release and resource-profile inputs unchanged', () => {
    expect(YAML.parse(
      read('skeletons/component/system-repo/base/releases/${{ values.buildEnvironment }}.yaml'),
    )).toEqual({image: {tag: 'latest'}});
    expect(YAML.parse(
      read('skeletons/component/promotion/${{ values.targetEnvironment }}.yaml'),
    )).toEqual({image: {tag: '${{ values.releaseVersion }}'}});
    expect(YAML.parse(
      read('skeletons/resource/implementations/postgresql/system-repo/base/values.yaml'),
    ).implementation.path).toBe('charts/resource/postgresql');
  });

  it('API and Component templates fetch runtime endpoints through the target', () => {
    for (const templatePath of ['templates/api/template.yaml', 'templates/component/template.yaml']) {
      const source = read(templatePath);
      expect(source).toContain('entityRef: ${{ steps.fetchDomain.output.entity.spec.platformTarget }}');
      expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.schemaRegistry.apiUrl');
      expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.cluster.routerDomain');
      expect(source).not.toContain('fetchTargetValues');
      expect(source).not.toContain('parseTargetValues');
      expect(source).not.toContain('steps.fetchTarget.output.entity.spec.schemaRegistry.apiUrl');
      expect(source).not.toContain('steps.fetchTarget.output.entity.spec.cluster.routerDomain');
      expect(source).not.toContain('steps.fetchDomain.output.entity.spec.schemaRegistry');
      expect(source).not.toContain('.clusterDomain }}');
    }
  });
});

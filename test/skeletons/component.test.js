const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {XMLValidator} = require('fast-xml-parser');
const YAML = require('yaml');
const {
  consumedApis,
  profileValues,
  providedApi,
} = require('../helpers/componentProfileFixtures');
const {renderComponentProfile, renderDirectory} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

const profiles = [
  'spring-boot-openapi',
  'spring-boot-camel-openapi',
  'quarkus-camel-openapi',
  'quarkus-camel-openapi-yaml',
];
const exactSha = '0123456789abcdef0123456789abcdef01234567';

const scenarios = {
  basic: {provided_api: null, consumed_apis: []},
  'cross-system': {
    provided_api: {...providedApi, version: 'v2.1.3'},
    consumed_apis: [
      consumedApis.bookinfoDetails,
      {...consumedApis.payments, version: 'v2.1.3'},
      {...consumedApis.vendorDetails, version: exactSha},
      consumedApis.wiringOnly,
    ],
  },
};

describe('Component implementation profiles', () => {
  let temporaryRoot;

  beforeAll(async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'component-skeleton-'));
  });

  afterAll(async () => {
    await fs.rm(temporaryRoot, {recursive: true, force: true});
  });

  test.each(profiles)('%s renders the basic and cross-System scenarios', async profile => {
    for (const [scenario, selection] of Object.entries(scenarios)) {
      const destination = path.join(temporaryRoot, profile, scenario);
      await renderComponentProfile({
        root,
        profile,
        destination,
        values: profileValues({
          implementationProfile: profile,
          ...selection,
        }),
      });
      const files = await fs.readdir(destination, {recursive: true});
      const textFiles = [];
      for (const relative of files) {
        const file = path.join(destination, relative);
        if (!(await fs.stat(file)).isFile() || relative.endsWith('.jar')) continue;
        const content = await fs.readFile(file);
        if (!content.subarray(0, 8192).includes(0)) textFiles.push(content.toString('utf8'));
      }
      const generated = textFiles.join('\n');
      const pom = await fs.readFile(path.join(destination, 'pom.xml'), 'utf8');

      expect(XMLValidator.validate(pom)).toBe(true);
      expect(generated).not.toContain('${{');
      expect(generated).not.toContain('{%');
      expect(pom).toContain('<groupId>io.github.cfidp.storefront</groupId>');
      expect(pom).toContain('<artifactId>registry-verification</artifactId>');
      expect(generated).not.toMatch(/\.dockerconfigjson|clientSecret|BEGIN PRIVATE KEY/);

      if (scenario === 'basic') {
        expect(pom).not.toContain('apicurio-registry-maven-plugin');
        continue;
      }
      for (const alias of [
        'cf-idp-integration-tests-details',
        'payments-authorization',
        'vendor-details',
        'cf-idp-integration-tests-wiring-only',
      ]) {
        expect(pom).toContain(`${alias}-api.yaml`);
      }
      expect(pom).toContain('<version>v2.1.3</version>');
      expect(pom).toContain(`<version>${exactSha}</version>`);
      expect(generated).not.toContain(
        'direct:cf-idp-integration-tests-wiring-only.',
      );
      if (profile !== 'spring-boot-openapi') {
        expect(generated).toMatch(/missingOperation\(["']mock["']\)|missingOperation:\s*mock/);
        expect(generated).not.toMatch(/missingOperation\(["']ignore["']\)|missingOperation:\s*ignore/);
        expect(generated).toContain(
          'direct:cf-idp-integration-tests-details.getProduct',
        );
        expect(generated).toContain('direct:vendor-details.getProduct');
      }
    }
  });
});

test('Component desired-state base includes values and the initial build release', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'component-desired-state-'));
  try {
    const values = {
      componentName: 'storefront-client',
      componentRepoCloneUrl: 'https://git.example/storefront-client.git',
      implementationProfile: 'quarkus-camel-openapi',
      dockerfilePath: './src/main/docker/Dockerfile.jvm',
      buildEnabled: true,
      sourceRevision: 'main',
      buildEnvironment: 'sandbox',
      environment: 'sandbox',
    };
    await renderDirectory({
      source: path.join(root, 'skeletons/component/system-repo/base'),
      destination,
      values,
    });
    await renderDirectory({
      source: path.join(root, 'skeletons/component/system-repo/environment'),
      destination: path.join(destination, 'environments'),
      values,
    });
    expect(YAML.parse(await fs.readFile(path.join(destination, 'values.yaml'), 'utf8')))
      .toHaveProperty('build.enabled', true);
    expect(YAML.parse(await fs.readFile(
      path.join(destination, 'releases/sandbox.yaml'), 'utf8')))
      .toEqual({image: {tag: 'latest'}});
    expect(YAML.parse(await fs.readFile(
      path.join(destination, 'environments/sandbox.yaml'), 'utf8')))
      .toHaveProperty('image.pullPolicy', 'Always');
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});

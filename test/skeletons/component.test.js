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
  'nodejs-openapi',
];

const exactSha = '0123456789abcdef0123456789abcdef01234567';

const scenarios = {
  basic: {
    provided_api: null,
    consumed_apis: [],
  },
  'cross-system': {
    provided_api: {
      ...providedApi,
      version: 'v2.1.3',
    },
    consumed_apis: [
      consumedApis.bookinfoDetails,
      {
        ...consumedApis.payments,
        version: 'v2.1.3',
      },
      {
        ...consumedApis.vendorDetails,
        version: exactSha,
      },
      consumedApis.wiringOnly,
    ],
  },
};

describe('Component implementation profiles', () => {
  let temporaryRoot;

  beforeAll(async () => {
    temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'component-skeleton-'),
    );
  });

  afterAll(async () => {
    await fs.rm(temporaryRoot, {
      recursive: true,
      force: true,
    });
  });

  test.each(profiles)(
    '%s renders the basic and cross-System scenarios',
    async profile => {
      for (const [scenario, selection] of Object.entries(scenarios)) {
        const destination = path.join(
          temporaryRoot,
          profile,
          scenario,
        );

        await renderComponentProfile({
          root,
          profile,
          destination,
          values: profileValues({
            implementationProfile: profile,
            ...selection,
          }),
        });

        const files = await fs.readdir(destination, {
          recursive: true,
        });

        const textFiles = [];

        for (const relative of files) {
          const file = path.join(destination, relative);

          if (
            !(await fs.stat(file)).isFile()
            || relative.endsWith('.jar')
          ) {
            continue;
          }

          const content = await fs.readFile(file);

          if (!content.subarray(0, 8192).includes(0)) {
            textFiles.push(content.toString('utf8'));
          }
        }

        const generated = textFiles.join('\n');

        expect(generated).not.toContain('${{');
        expect(generated).not.toContain('{%');
        expect(generated).not.toMatch(
          /\.dockerconfigjson|clientSecret|BEGIN PRIVATE KEY/,
        );

        if (profile === 'nodejs-openapi') {
          const packageJson = JSON.parse(
            await fs.readFile(
              path.join(destination, 'package.json'),
              'utf8',
            ),
          );

          expect(packageJson.engines.node).toBe('>=24 <25');

          expect(packageJson.scripts).toMatchObject({
            'generate:openapi': 'node scripts/generate-openapi.mjs',
            build: 'npm run generate:openapi && tsc -p tsconfig.json',
            test: 'npm run build && node --test dist/test/*.test.js',
          });

          expect(generated).toContain("from 'openapi-backend'");
          expect(generated).toContain('validateResponse');
          expect(generated).toContain('mockResponseForOperation');
          expect(generated).toContain('/health/ready');
          expect(generated).toContain('/health/live');
          expect(generated).toContain(
            'registry.access.redhat.com/ubi9/nodejs-24:latest',
          );

          const openapiConfig = JSON.parse(
            await fs.readFile(
              path.join(destination, 'openapi.config.json'),
              'utf8',
            ),
          );

          if (scenario === 'basic') {
            expect(openapiConfig.provided).toBeNull();
            expect(openapiConfig.consumed).toEqual([]);
          } else {
            expect(openapiConfig.provided).toMatchObject({
              version: 'v2.1.3',
            });

            expect(openapiConfig.consumed).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  alias: 'cf-idp-integration-tests-details',
                  version: 'latest',
                  defaultBaseUrl: 'http://details:8080',
                }),
                expect.objectContaining({
                  alias: 'payments-authorization',
                  version: 'v2.1.3',
                  defaultBaseUrl: 'http://authorization:8080',
                }),
                expect.objectContaining({
                  alias: 'vendor-details',
                  version: exactSha,
                  defaultBaseUrl: 'http://details:8080',
                }),
                expect.objectContaining({
                  alias: 'cf-idp-integration-tests-wiring-only',
                  version: 'latest',
                  defaultBaseUrl: 'http://wiring-only:8080',
                }),
              ]),
            );

            expect(generated).toContain('OpenAPIClientAxios');
            expect(generated).toContain('function envName(alias)');
            expect(generated).toContain('OPENAPI_CLIENT_');
            expect(generated).toContain('defaultBaseUrl');
          }

          continue;
        }

        const pom = await fs.readFile(
          path.join(destination, 'pom.xml'),
          'utf8',
        );

        expect(XMLValidator.validate(pom)).toBe(true);
        expect(pom).toContain(
          '<groupId>io.github.cfidp.storefront</groupId>',
        );
        expect(pom).toContain(
          '<artifactId>registry-verification</artifactId>',
        );

        if (scenario === 'basic') {
          expect(pom).not.toContain(
            'apicurio-registry-maven-plugin',
          );
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
          expect(generated).toMatch(
            /missingOperation\(["']mock["']\)|missingOperation:\s*mock/,
          );

          expect(generated).not.toMatch(
            /missingOperation\(["']ignore["']\)|missingOperation:\s*ignore/,
          );

          expect(generated).toContain(
            'direct:cf-idp-integration-tests-details.getProduct',
          );

          expect(generated).toContain(
            'direct:vendor-details.getProduct',
          );
        }
      }
    },
  );
});

test.each(Object.entries(scenarios))(
  'Component base renders clean catalog metadata for %s API selection',
  async (scenario, selection) => {
    const destination = await fs.mkdtemp(
      path.join(os.tmpdir(), 'component-base-'),
    );

    try {
      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/base',
        ),
        destination,
        values: {
          componentName: 'registry-verification',
          description: 'Hermetic Apicurio Registry verification',
          scmProvider: 'github',
          scmHost: 'github.com',
          domainOrg: 'contract-first-idp',
          domainRepo: 'storefront-domain',
          repositoryName: 'registry-verification',
          implementationProfile: 'spring-boot-openapi',
          buildProfile: 'spring-boot',
          owner: 'group:default/domain-maintainers',
          systemRef: 'system:cf-idp-integration-tests/storefront',
          schemaRegistryApiUrl:
            'https://apicurio.invalid/apis/registry/v3',
          implementsApi: Boolean(selection.provided_api),
          apiRef: selection.provided_api?.ref || '',
          ...selection,
        },
      });

      const catalog = YAML.parse(
        await fs.readFile(
          path.join(destination, 'catalog-info.yaml'),
          'utf8',
        ),
      );

      expect(
        catalog.spec.providesApis || [],
      ).toHaveLength(
        selection.provided_api ? 1 : 0,
      );

      expect(
        catalog.spec.consumesApis || [],
      ).toHaveLength(
        selection.consumed_apis.length,
      );
    } finally {
      await fs.rm(destination, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Component desired-state base includes values and the initial build release',
  async () => {
    const destination = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        'component-desired-state-',
      ),
    );

    try {
      const values = {
        componentName: 'storefront-client',
        componentRepoCloneUrl:
          'https://git.example/storefront-client.git',
        implementationProfile: 'quarkus-camel-openapi',
        buildProfile: 'quarkus-native',
        buildEnabled: true,
        sourceRevision: 'main',
        buildEnvironment: 'sandbox',
        environment: 'sandbox',
      };

      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/system-repo/base',
        ),
        destination,
        values,
      });

      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/system-repo/environment',
        ),
        destination: path.join(
          destination,
          'environments',
        ),
        values,
      });

      const desiredState = YAML.parse(
        await fs.readFile(
          path.join(destination, 'values.yaml'),
          'utf8',
        ),
      );

      expect(desiredState).toHaveProperty(
        'build.enabled',
        true,
      );

      expect(desiredState).toHaveProperty(
        'build.profile',
        'quarkus-native',
      );

      expect(desiredState.build).not.toHaveProperty(
        'dockerfilePath',
      );

      expect(
        YAML.parse(
          await fs.readFile(
            path.join(
              destination,
              'releases/sandbox.yaml',
            ),
            'utf8',
          ),
        ),
      ).toEqual({
        image: {
          tag: 'latest',
        },
      });

      expect(
        YAML.parse(
          await fs.readFile(
            path.join(
              destination,
              'environments/sandbox.yaml',
            ),
            'utf8',
          ),
        ),
      ).toHaveProperty(
        'image.pullPolicy',
        'Always',
      );

      const environmentSource = await fs.readFile(
        path.join(
          root,
          'skeletons/component/system-repo/environment/${{ values.environment }}.yaml',
        ),
        'utf8',
      );

      expect(environmentSource).not.toMatch(
        /quarkus|spring|nodejs|implementationProfile/,
      );
    } finally {
      await fs.rm(destination, {
        recursive: true,
        force: true,
      });
    }
  },
);
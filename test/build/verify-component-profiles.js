const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {profileValues} = require('../utils/componentProfileFixtures');
const {renderComponentProfile} = require('../utils/profileRenderer');

const root = path.resolve(__dirname, '../..');
const profiles = [
  'spring-boot-openapi',
  'spring-boot-camel-openapi',
  'quarkus-camel-openapi',
  'quarkus-camel-openapi-yaml',
];

function verify(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn('./mvnw', ['-ntp', '-q', 'verify'], {
      cwd: directory,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve()
      : reject(new Error(`Maven verify exited ${code} in ${directory}`)));
  });
}

async function main() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'component-build-'));
  try {
    for (const profile of profiles) {
      const directory = path.join(temporaryRoot, profile);
      await renderComponentProfile({
        root,
        profile,
        destination: directory,
        values: profileValues({
          implementationProfile: profile,
          provided_api: null,
          consumed_apis: [],
        }),
      });
      await verify(directory);
      console.log(`Maven baseline passed: ${profile}`);
    }
  } finally {
    await fs.rm(temporaryRoot, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

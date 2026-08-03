const {spawnSync} = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({path: path.resolve(process.cwd(), 'test/.env')});

const required = [
  'BACKSTAGE_URL',
  'TEST_DOMAIN_REF',
  'TEST_SYSTEM_REF',
  'TEST_COMPONENT_REF',
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error([
    'Cannot run the Backstage dry-run smoke suite.',
    `Missing environment variables: ${missing.join(', ')}`,
    'This command targets a live Backstage installation; configure test/.env first.',
  ].join('\n'));
  process.exit(2);
}

const jest = require.resolve('jest/bin/jest');
const result = spawnSync(process.execPath, [
  jest, 'test/smoke', '--runInBand',
], {stdio: 'inherit'});
process.exit(result.status ?? 1);

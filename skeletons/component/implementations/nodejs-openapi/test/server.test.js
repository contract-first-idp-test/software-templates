import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {createServer} from '../src/server.js';

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('reports live and ready using built-in fetch', async () => {
  for (const path of ['/health/live', '/health/ready']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: 'UP'});
  }
});

test('serves the component root and rejects unknown paths', async () => {
  const root = await fetch(`${baseUrl}/`);
  assert.equal(root.status, 200);
  assert.equal((await root.json()).component, '${{ values.component_id }}');
  assert.equal((await fetch(`${baseUrl}/missing`)).status, 404);
});

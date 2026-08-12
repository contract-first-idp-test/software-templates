import http from 'node:http';
import {pathToFileURL} from 'node:url';

const component = '${{ values.component_id }}';

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {'content-type': 'application/json'});
  response.end(JSON.stringify(body));
}

export function createServer() {
  return http.createServer((request, response) => {
    if (request.method === 'GET' && [
      '/health', '/health/live', '/health/ready',
    ].includes(request.url)) {
      sendJson(response, 200, {status: 'UP'});
      return;
    }

    if (request.method === 'GET' && request.url === '/') {
      sendJson(response, 200, {component, message: '${{ values.description }}'});
      return;
    }

    sendJson(response, 404, {error: 'not found'});
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT || '8080', 10);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`${component} listening on ${port}`);
  });
}

const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 4173);
const files = new Map([
  ['/index.html', 'text/html; charset=utf-8'],
  ['/style.css', 'text/css; charset=utf-8'],
  ['/engine.js', 'text/javascript; charset=utf-8'],
  ['/app.js', 'text/javascript; charset=utf-8'],
  ['/arena.svg', 'image/svg+xml'],
  ['/favicon.svg', 'image/svg+xml'],
]);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be an integer from 0 to 65535.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const pathname = request.url.split('?')[0];
  const asset = pathname === '/' ? '/index.html' : pathname;
  const type = files.get(asset);
  if (!type) {
    response.writeHead(404).end();
    return;
  }

  try {
    const body = await readFile(join(__dirname, asset.slice(1)));
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});

server.on('error', (error) => {
  console.error(`Could not start the game server (${error.code}).`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Clone Rift is ready at http://${host}:${server.address().port}`);
});

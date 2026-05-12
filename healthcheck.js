// Docker healthcheck: exits 0 once CourseRegistry is deployed, 1 otherwise.
const http = require('http');
const body = JSON.stringify({
  jsonrpc: '2.0',
  method: 'eth_getCode',
  params: ['0x5FbDB2315678afecb367f032d93F642f64180aa3', 'latest'],
  id: 1,
});

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 8545,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        // "0x" = no code; anything longer = contract deployed
        process.exit(json.result && json.result.length > 3 ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  }
);
req.on('error', () => process.exit(1));
req.write(body);
req.end();

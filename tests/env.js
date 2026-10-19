/* Reads the project's .env file. It holds test project keys and is never committed. */
const fs = require('fs');
const path = require('path');

function readEnv(root) {
  const env = {};
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

module.exports = { readEnv };

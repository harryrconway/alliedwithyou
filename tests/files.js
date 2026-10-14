/* Lists project files for the checks, skipping the tests, git and dependencies. */
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['.git', 'node_modules', 'tests']);

module.exports = function files(root, ext) {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (!ext || p.endsWith(ext)) out.push(p);
    }
  })(root);
  return out;
};

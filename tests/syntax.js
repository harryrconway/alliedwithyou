/* Every script must parse. */
const { execFileSync } = require('child_process');
const path = require('path');
const files = require('./files');

module.exports = async function syntax(ctx) {
  const failures = [];
  for (const file of files(ctx.root, '.js')) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      failures.push(path.relative(ctx.root, file) + ': ' + String(error.stderr).split('\n').slice(0, 4).join(' '));
    }
  }
  return failures;
};

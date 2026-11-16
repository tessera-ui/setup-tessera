const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { restoreSourceMtimes } = require('./source-mtimes.cjs');

const root = process.env.GITHUB_WORKSPACE;
const target = process.env['INPUT_TARGET-DIRECTORY'];
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
} catch {
  process.exit(0);
}
restoreSourceMtimes(root, target);
fs.appendFileSync(process.env.GITHUB_STATE, `paths=${JSON.stringify({ root, target })}\n`);

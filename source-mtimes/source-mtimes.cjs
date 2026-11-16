const { execFileSync } = require('node:child_process');
const path = require('node:path');

function sourceMtimes(root, target, mode) {
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
    path.join(__dirname, 'source_mtimes.py'), root, target, mode,
  ], { stdio: 'inherit' });
}

module.exports = {
  restoreSourceMtimes: (root, target) => sourceMtimes(root, target, 'restore'),
  saveSourceMtimes: (root, target) => sourceMtimes(root, target, 'save'),
};

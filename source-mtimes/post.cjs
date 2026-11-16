const { saveSourceMtimes } = require('./source-mtimes.cjs');

if (process.env.STATE_paths) {
  const { root, target } = JSON.parse(process.env.STATE_paths);
  saveSourceMtimes(root, target);
}

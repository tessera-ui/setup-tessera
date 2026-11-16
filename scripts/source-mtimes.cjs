const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function restoreSourceMtimes(root, target) {
  const files = execFileSync('git', ['ls-files', '--recurse-submodules', '-z'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);
  const statePath = path.resolve(root, target, '.setup-tessera-source-mtimes.json');
  const previous = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : {};
  const current = {};
  const directories = new Set();
  let restored = 0;
  for (const file of files) {
    const source = path.join(root, file);
    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) continue;
    const hash = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const stat = fs.statSync(source);
    if (previous.files?.[file]?.hash === hash) {
      // Cargo compares source mtimes with dep-info even when the bytes are unchanged.
      fs.utimesSync(source, stat.atimeMs / 1000, previous.files[file].mtime / 1000);
      restored++;
    }
    current[file] = { hash, mtime: fs.statSync(source).mtimeMs };
    for (let dir = path.posix.dirname(file); dir !== '.'; dir = path.posix.dirname(dir)) {
      directories.add(dir);
    }
  }
  const directoryState = {};
  for (const directory of [...directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
    const source = path.join(root, directory);
    const entries = fs.readdirSync(source).filter(name => name !== '.git').sort().map(name => {
      const child = `${directory}/${name}`;
      const stat = fs.lstatSync(path.join(root, child));
      return [name, stat.isDirectory() ? 'directory' : 'file', current[child]?.hash ?? directoryState[child]?.hash ?? null];
    });
    const hash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    const stat = fs.statSync(source);
    if (previous.directories?.[directory]?.hash === hash) {
      fs.utimesSync(source, stat.atimeMs / 1000, previous.directories[directory].mtime / 1000);
    }
    directoryState[directory] = { hash, mtime: fs.statSync(source).mtimeMs };
  }
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ files: current, directories: directoryState }));
  console.log(`Restored timestamps for ${restored}/${Object.keys(current).length} unchanged source files.`);
}

module.exports = { restoreSourceMtimes };

if (require.main === module) {
  restoreSourceMtimes(process.cwd(), process.argv[2]);
}

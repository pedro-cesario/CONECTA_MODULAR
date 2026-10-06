const path = require('path');
const fs = require('fs');

function getVersionData() {
  let version = '1.0.0';
  let showTestBar = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8'));
    version = pkg.version || version;
    showTestBar = !!pkg.showTestBar;
  } catch {}
  return { ok: true, version, showTestBar };
}

function versionHandler(req, res) {
  res.json(getVersionData());
}

module.exports = {
  getVersionData,
  versionHandler
};

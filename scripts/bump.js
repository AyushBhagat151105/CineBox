const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const appJsonPath = path.join(rootDir, 'app.json');
const gradlePath = path.join(rootDir, 'android/app/build.gradle');

const bumpType = process.argv[2] || 'patch'; // 'patch' | 'minor' | 'major'

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: bun scripts/bump.js [patch|minor|major]');
  process.exit(1);
}

// 1. Read package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '1.0.0';
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newMajor = major;
let newMinor = minor;
let newPatch = patch;

if (bumpType === 'major') {
  newMajor += 1;
  newMinor = 0;
  newPatch = 0;
} else if (bumpType === 'minor') {
  newMinor += 1;
  newPatch = 0;
} else {
  newPatch += 1;
}

const newVersion = `${newMajor}.${newMinor}.${newPatch}`;

// 2. Read app.json and increment versionCode
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const currentVersionCode = appJson.expo?.android?.versionCode || 1;
const newVersionCode = currentVersionCode + 1;

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json: ${currentVersion} -> ${newVersion}`);

// Update app.json
appJson.expo.version = newVersion;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = newVersionCode;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`✅ app.json: version ${newVersion}, versionCode ${newVersionCode}`);

// Update android/app/build.gradle
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
  fs.writeFileSync(gradlePath, gradle);
  console.log(`✅ android/app/build.gradle: versionCode ${newVersionCode}, versionName "${newVersion}"`);
}

console.log(`\n🎉 Successfully bumped CineBox to v${newVersion} (code: ${newVersionCode})`);
console.log(`\nNext steps:`);
console.log(`  git commit -am "chore(release): bump version to v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push && git push --tags\n`);

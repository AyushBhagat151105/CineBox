const fs = require('fs');
const path = require('path');

const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
const outputPath = path.resolve(__dirname, '../RELEASE_NOTES.md');

const tag = (process.env.TAG_NAME || process.argv[2] || '').replace(/^v/, '').trim();

if (!tag) {
  console.log('[Changelog] No tag specified. Skipping release notes extraction.');
  process.exit(0);
}

if (!fs.existsSync(changelogPath)) {
  console.log('[Changelog] CHANGELOG.md not found.');
  process.exit(0);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');

// Matches `## [v1.0.1]` or `## [1.0.1]` header line and captures up to the next `## [` or EOF
const headerRegex = new RegExp(`##\\s*\\[v?${tag.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s*\\[|$)`, 'i');
const match = changelog.match(headerRegex);

if (match && match[1].trim()) {
  const notes = match[1].trim();
  fs.writeFileSync(outputPath, notes + '\n');
  console.log(`[Changelog] Successfully extracted release notes for v${tag} to RELEASE_NOTES.md`);
} else {
  console.log(`[Changelog] No section found in CHANGELOG.md for version: ${tag}`);
}

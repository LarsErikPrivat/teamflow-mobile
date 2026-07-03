import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = pkg.version;

const content = `export const APP_VERSION = '${version}';\n`;
writeFileSync('./src/environments/environments/version.ts', content);

console.log(`Version set to ${version}`);

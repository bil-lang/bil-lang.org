#!/usr/bin/env node
// Refreshes vendor/{marked,mermaid} from the npm packages pinned in
// package.json, and smoke-tests each build (actually parses markdown /
// renders a diagram) before it's trusted.
//
// Usage:
//   npm run vendor        copy the pinned packages' browser builds into
//                          vendor/ and smoke-test them
//   npm run vendor:check  same, but don't write -- fail if vendor/ is
//                          stale or a build doesn't work (for CI)
//
// Either way it also checks npm for a release newer than what's pinned
// in package.json and prints a note (it never bumps the pin itself --
// that's a deliberate `npm install <pkg>@latest --save-dev` decision).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkOnly = process.argv.includes('--check');

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function sha(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function latestVersion(pkgName) {
  try {
    return execFileSync('npm', ['view', pkgName, 'version'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function smokeTestMarked(code) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'marked.min.js' });
  const html = sandbox.marked?.parse?.('# Hello');
  if (!html || !html.includes('<h1>Hello</h1>')) {
    throw new Error(`marked.parse('# Hello') didn't return the expected heading (got: ${html})`);
  }
}

async function smokeTestMermaid(code) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });
  // jsdom has no layout engine -- stub the SVG metrics mermaid's layout pass needs.
  dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 20 });
  dom.window.SVGElement.prototype.getComputedTextLength = () => 50;
  const script = dom.window.document.createElement('script');
  script.textContent = code;
  dom.window.document.body.appendChild(script);
  if (typeof dom.window.mermaid?.initialize !== 'function') {
    throw new Error('mermaid.min.js did not expose window.mermaid.initialize');
  }
  dom.window.mermaid.initialize({ startOnLoad: false });
  const { svg } = await dom.window.mermaid.render('vendorCheck', 'graph TD; A-->B;');
  if (!svg || !svg.includes('<svg')) {
    throw new Error("mermaid.render() didn't return an <svg> document");
  }
}

const LIBS = [
  {
    name: 'marked',
    pkg: 'marked',
    src: 'node_modules/marked/lib/marked.umd.js',
    dest: 'vendor/marked/marked.min.js',
    smokeTest: smokeTestMarked,
  },
  {
    name: 'mermaid',
    pkg: 'mermaid',
    src: 'node_modules/mermaid/dist/mermaid.min.js',
    dest: 'vendor/mermaid/mermaid.min.js',
    smokeTest: smokeTestMermaid,
  },
];

let failed = false;

for (const lib of LIBS) {
  const pinned = pkg.devDependencies[lib.pkg];
  console.log(`\n${lib.name} (pinned ${pinned})`);

  const latest = latestVersion(lib.pkg);
  if (latest === null) {
    console.log('  ! could not reach npm registry to check for a newer version, skipping freshness check');
  } else if (latest !== pinned) {
    console.log(`  ! newer version available: ${pinned} -> ${latest}`);
    console.log(`    run: npm install ${lib.pkg}@${latest} --save-dev && npm run vendor`);
  } else {
    console.log('  up to date with npm');
  }

  const srcPath = path.join(root, lib.src);
  if (!existsSync(srcPath)) {
    console.log(`  ! ${lib.src} not found -- run \`npm install\` first`);
    failed = true;
    continue;
  }
  const srcCode = readFileSync(srcPath);

  try {
    await lib.smokeTest(srcCode.toString('utf8'));
    console.log('  smoke test passed');
  } catch (e) {
    console.log(`  ! smoke test FAILED: ${e.message}`);
    failed = true;
    continue;
  }

  const destPath = path.join(root, lib.dest);
  const destCode = existsSync(destPath) ? readFileSync(destPath) : null;
  const changed = !destCode || sha(destCode) !== sha(srcCode);

  if (checkOnly) {
    if (changed) {
      console.log(`  ! ${lib.dest} does not match node_modules/${lib.pkg} -- run \`npm run vendor\``);
      failed = true;
    } else {
      console.log(`  ${lib.dest} matches node_modules/${lib.pkg}`);
    }
  } else if (changed) {
    writeFileSync(destPath, srcCode);
    console.log(`  wrote ${lib.dest}`);
  } else {
    console.log(`  ${lib.dest} already matches node_modules/${lib.pkg}`);
  }
}

console.log('');
if (failed) {
  console.log('vendor check failed');
  process.exit(1);
}
console.log('all vendored libs present, current, and working');

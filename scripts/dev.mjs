#!/usr/bin/env node
/**
 * One-command local development:
 *   1. builds Cloud Functions once so the emulator has `lib/index.js`
 *   2. starts the Firebase Emulator Suite (auth, firestore, functions, hosting)
 *   3. starts the Vite dev server for the web app
 *
 * Ctrl+C stops both child processes.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

const children = [];

function run(command, args, options) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev] ${command} ${args.join(' ')} exited with code ${code}`);
    }
  });
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!existsSync(join(root, 'functions', 'node_modules'))) {
  console.log('[dev] installing functions dependencies...');
  run(npm, ['--prefix', 'functions', 'install']);
}

if (!existsSync(join(root, 'apps', 'web', 'node_modules'))) {
  console.log('[dev] installing web dependencies...');
  run(npm, ['--prefix', 'apps/web', 'install']);
}

console.log('[dev] building Cloud Functions...');
run(npm, ['--prefix', 'functions', 'run', 'build']).on('exit', (code) => {
  if (code !== 0) {
    console.error('[dev] functions build failed; aborting.');
    process.exit(code ?? 1);
  }

  console.log('[dev] starting emulators + vite...');
  run('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore,functions,hosting']);
  run(npm, ['--prefix', 'apps/web', 'run', 'dev']);
});

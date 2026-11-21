#!/usr/bin/env node
/**
 * Fails the build if anything that looks like a real credential is committed.
 * Deliberately conservative: placeholders and env var *names* are fine.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath handles spaces and drive letters correctly on Windows.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'lib',
  'coverage',
  '.firebase',
  'build',
]);

const IGNORED_FILES = new Set(['package-lock.json', 'check-secrets.mjs']);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.html',
  '.css',
  '.env',
  '.example',
  '.rules',
  '.txt',
]);

const PATTERNS = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Gemini key assignment', regex: /GEMINI_API_KEY\s*[:=]\s*["']?[0-9A-Za-z_-]{20,}/ },
  { name: 'OpenAI style key', regex: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  {
    name: 'Service account private key',
    regex: /"private_key"\s*:\s*"-----BEGIN/,
  },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
];

const findings = [];

function scan(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (IGNORED_DIRS.has(entry)) continue;
      scan(join(path, entry));
    }
    return;
  }

  if (IGNORED_FILES.has(path.split(/[\\/]/).pop() ?? '')) return;
  if (!TEXT_EXTENSIONS.has(extname(path))) return;
  if (stats.size > 512 * 1024) return;

  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.includes('PLACEHOLDER') || line.includes('your-')) continue;
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relative(ROOT, path),
          line: index + 1,
          rule: pattern.name,
        });
      }
    }
  }
}

function extname(path) {
  const base = path.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  // Treat `.env.example` style suffixes as text.
  return base.slice(dot).toLowerCase();
}

scan(ROOT);

if (findings.length > 0) {
  console.error('Potential secrets detected:\n');
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.rule}]`);
  }
  console.error('\nRemove the value, rotate the credential, and use Secret Manager or .env.local.');
  process.exit(1);
}

console.log('check-secrets: no credentials found.');

// Empacota os executáveis Windows (portátil + instalador NSIS).
// O electron-builder grava numa pasta temporária do sistema e só os .exe finais são
// copiados para release/: pastas sincronizadas (OneDrive, Dropbox) travam a renomeação
// de win-unpacked e fazem o build falhar com EPERM.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(tmpdir(), 'eletrilab-3d-release');
const release = join(root, 'release');

rmSync(tmp, { recursive: true, force: true });
const r = spawnSync('npx', ['electron-builder', '--win', 'portable', 'nsis', `-c.directories.output=${tmp}`], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (r.status !== 0) process.exit(r.status ?? 1);

mkdirSync(release, { recursive: true });
const exes = readdirSync(tmp).filter((f) => f.toLowerCase().endsWith('.exe') && !f.includes('__uninstaller'));
for (const f of exes) copyFileSync(join(tmp, f), join(release, f));
console.log(`\nExecutáveis copiados para release/:\n${exes.map((f) => `  - ${f}`).join('\n')}`);

// Monta a pasta desktop-app/ que o electron-builder empacota.
// Contém apenas o build web (dist/), o processo principal e um package.json mínimo,
// sem node_modules: todo o código do app já está empacotado pelo Vite.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'desktop-app');
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ não encontrado: execute "npm run build" antes.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'electron'), { recursive: true });
cpSync(dist, join(out, 'dist'), { recursive: true });
cpSync(join(root, 'electron', 'main.cjs'), join(out, 'electron', 'main.cjs'));
mkdirSync(join(out, 'build'), { recursive: true });
cpSync(join(root, 'build', 'icon.png'), join(out, 'build', 'icon.png'));

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      productName: 'EletriLab 3D',
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      main: 'electron/main.cjs',
    },
    null,
    2,
  ),
);
console.log(`desktop-app/ preparado (versão ${pkg.version}).`);

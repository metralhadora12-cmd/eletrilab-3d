// Processo principal do Electron: empacota o build web (dist/) como aplicativo desktop.
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('node:path');

const devUrl = !app.isPackaged ? process.env.ELETRILAB_DEV_URL : undefined;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** @type {BrowserWindow | null} */
let win = null;

const isExternal = (url) => /^https?:\/\//i.test(url);

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'EletriLab 3D',
    backgroundColor: '#11151b',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win && win.show());

  // Janela em branco é usada para imprimir/gerar PDF do diagrama; links externos vão para o navegador padrão.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank') {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#ffffff' } };
    }
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // O app nunca navega para fora dos próprios arquivos.
  win.webContents.on('will-navigate', (event, url) => {
    if (devUrl && url.startsWith(devUrl)) return;
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });

  // Com alterações não salvas o renderer cancela o fechamento; aqui o usuário decide.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Sair sem salvar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Alterações não salvas',
      message: 'Há alterações não salvas no projeto.',
      detail: 'Uma cópia de recuperação foi guardada pelo salvamento automático. Deseja sair mesmo assim?',
    });
    if (choice === 0) event.preventDefault();
  });

  win.on('closed', () => {
    win = null;
  });

  if (process.env.ELETRILAB_SMOKE_TEST) attachSmokeTest(win);

  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

/**
 * Autoteste (somente com ELETRILAB_SMOKE_TEST=1): carrega o app, verifica se a cena 3D e o
 * terminal de diagnóstico renderizaram, imprime o resultado em JSON e encerra.
 */
function attachSmokeTest(w) {
  const errors = [];
  w.webContents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  w.webContents.on('did-fail-load', (_e, code, desc) => errors.push(`did-fail-load ${code} ${desc}`));
  w.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      let result = {};
      try {
        result = await w.webContents.executeJavaScript(`({
          title: document.title,
          canvas: !!document.querySelector('canvas'),
          webgl: (() => { const c = document.querySelector('canvas'); return !!(c && (c.getContext('webgl2') || c.getContext('webgl'))); })(),
          statement: document.querySelector('.statement')?.textContent?.slice(0, 80) ?? null,
          storage: (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch { return false; } })(),
        })`);
      } catch (e) {
        errors.push(String(e));
      }
      process.stdout.write(`SMOKE ${JSON.stringify({ ...result, errors })}\n`);
      app.exit(errors.length || !result.canvas ? 1 : 0);
    }, 5000);
  });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());

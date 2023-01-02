const {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain,
  shell,
  Tray,
  Menu,
} = require("electron");
const path = require("path");
const pty = require("node-pty");
const fs = require("fs");
const fspromises = require("fs/promises");
const os = require("os");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

let PATH = process.env.PATH;
const userpath = path.join(os.homedir(), ".config", "sunbeam-gui", "env");
if (fs.existsSync(userpath)) {
  PATH = fs.readFileSync(userpath);
}

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

app.on("window-all-closed", () => {
  app.quit();
});

function createWindow() {
  const bounds = getCenterOnCurrentScreen();
  const win = new BrowserWindow({
    title: "Sunbeam",
    width: 750,
    height: 475,
    frame: false,
    x: bounds.x,
    y: bounds.y,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    resizable: false,
    type: "panel",
    show: false,
    hasShadow: true,
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, "index.html"));

  ipcMain.handle("theme", async () => {
    const theme = process.env.SUNBEAM_THEME || "tomorrow-night";
    const content = await fspromises.readFile(
      path.join(__dirname, "..", "themes", `${theme}.json`),
      "utf-8"
    );
    return JSON.parse(content);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("did-start-loading", () => {
    win.hide();
  });

  win.on("blur", () => {
    win.hide();
  });

  return win;
}

const getCenterOnCurrentScreen = () => {
  const cursor = screen.getCursorScreenPoint();
  // Get display with cursor
  const distScreen = screen.getDisplayNearestPoint({
    x: cursor.x,
    y: cursor.y,
  });

  const { width: screenWidth, height: screenHeight } = distScreen.workAreaSize;
  const width = 750;
  const height = 475;
  const x = distScreen.workArea.x + Math.floor(screenWidth / 2 - width / 2); // * distScreen.scaleFactor
  const y = distScreen.workArea.y + Math.floor(screenHeight / 2 - height / 2);

  return {
    width,
    height,
    x,
    y,
  };
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.on("window-all-closed", () => {
  // pass
});
app.setAsDefaultProtocolClient("sunbeam");
if (process.platform === "darwin") {
  app.dock.hide();
}

app.whenReady().then(async () => {
  const win = createWindow();
  win.webContents.on("dom-ready", async () => {
    globalShortcut.register("CommandOrControl+;", async () => {
      if (win.isVisible()) {
        win.hide();
      } else {
        const bounds = getCenterOnCurrentScreen();
        if (JSON.stringify(bounds) !== JSON.stringify(win.getBounds())) {
          win.setBounds(bounds);
          await sleep(50);
        }
        win.show();
      }
    });

    const tray = new Tray(
      path.join(__dirname, "..", "assets", "tray-Template.png")
    );
    const contextMenu = Menu.buildFromTemplate([
      { type: "normal", label: "Open Sunbeam", click: () => win.show() },
      {
        type: "normal",
        label: "Open Config",
        click: () =>
          shell.openPath(
            path.join(os.homedir(), ".config", "sunbeam", "config.yaml")
          ),
      },
      { type: "separator" },
      {
        type: "normal",
        label: "Manual",
        click: () =>
          shell.openExternal("https://sunbeamlauncher.github.io/sunbeam"),
      },
      {
        type: "normal",
        label: "Report Bug",
        click: () =>
          shell.openExternal(
            "http://github.com/SunbeamLauncher/sunbeam/issues/new"
          ),
      },
      { type: "separator" },
      { type: "normal", label: "Quit", click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);

    while (true) {
      const signal = await runSunbeam(win);
      if (signal !== 0) {
        break;
      }
      win.hide();
    }
  });
});

function runSunbeam(win) {
  return new Promise((resolve, reject) => {
    const disposables = [];

    const ptyProcess = pty.spawn("sunbeam", [], {
      env: {
        ...process.env,
        TERM: "xterm-256color",
        PATH,
      },
    });

    disposables.push(
      ptyProcess.onData((data) => {
        win.webContents.send("pty-output", data);
      })
    );

    ipcMain.on("pty-resize", (_, columns, rows) => {
      ptyProcess.resize(columns, rows);
    });

    ipcMain.on("pty-input", (_, data) => {
      ptyProcess.write(data);
    });

    app.on("will-quit", () => {
      ptyProcess.kill();
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      if (!win.isDestroyed()) {
        win.webContents.send("pty-exit");
      }

      ipcMain.removeAllListeners("pty-resize");
      ipcMain.removeAllListeners("pty-input");
      app.removeAllListeners("will-quit");
      disposables.forEach((d) => d.dispose());

      if (exitCode === 0) {
        console.log("Sunbeam exited with code 0");
        resolve(signal);
      } else {
        reject(new Error(`Sunbeam exited with code ${exitCode}`));
      }
    });

    win.webContents.send("pty-ready");
  });
}

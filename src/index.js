const {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain,
  shell,
} = require("electron");
const path = require("path");
const url = require("url");
const pty = require("node-pty");
const os = require("os");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

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
    transparent: true,
    maximizable: false,
    vibrancy: "under-window",
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
  ipcMain.handle("hideWindow", () => win.hide());
  ipcMain.handle("showWindow", () => win.show());

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
    while (true) {
      const signal = await runSunbeam(win);
      if (signal !== 0) {
        break;
      }
      win.hide();
    }
  });

  app.on("open-url", (_, sunbeamUrl) => {
    const parsedUrl = url.parse(sunbeamUrl);
    switch (parsedUrl.host) {
      case "run":
        win.loadFile(MAIN_WINDOW_WEBPACK_ENTRY);
    }
  });
});

function runSunbeam(win) {
  return new Promise((resolve, reject) => {
    const disposables = [];
    const sunbeam = app.isPackaged
      ? path.join(process.resourcesPath, "sunbeam")
      : "sunbeam";

    const { shell } = os.userInfo();

    const ptyProcess = pty.spawn(shell, ["-c", sunbeam], {
      env: {
        ...process.env,
        TERM: "xterm-256color",
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

    win.webContents.send("pty-ready");

    app.on("will-quit", () => {
      ptyProcess.kill();
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
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
  });
}

import * as electron from "electron";
import * as path from "path";
import * as pty from "node-pty";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
const accelerator = "CommandOrControl+;";

const isSingleInstance = electron.app.requestSingleInstanceLock();
if (!isSingleInstance) {
  console.log("Sunbeam is already running");
  electron.app.quit();
  process.exit(0);
}

electron.app.on("window-all-closed", () => {
  electron.app.quit();
});

if (process.platform === "darwin") {
  electron.app.dock.hide();
}

function createWindow() {
  const bounds = getCenterOnCurrentScreen();
  const win = new electron.BrowserWindow({
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
      devTools: true,
    },
    resizable: false,
    type: "panel",
    hasShadow: true,
  });

  if (process.env.NODE_ENV === "development") {
    const rendererPort = process.argv[2];
    win.loadURL(`http://localhost:${rendererPort}`);
  } else {
    win.loadFile(
      path.join(electron.app.getAppPath(), "renderer", "index.html")
    );
  }

  // electron.nativeTheme.on("updated", () => {
  //   win.setBackgroundColor(
  //     electron.nativeTheme.shouldUseDarkColors
  //       ? theme.dark.background
  //       : theme.light.background
  //   );
  // });

  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("blur", () => {
    win.hide();
  });

  return win;
}

const getCenterOnCurrentScreen = () => {
  const cursor = electron.screen.getCursorScreenPoint();
  // Get display with cursor
  const distScreen = electron.screen.getDisplayNearestPoint({
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

function createTray(win) {
  const tray = new electron.Tray(
    path.join(__dirname, "static", "tray-Template.png")
  );
  tray.setContextMenu(
    electron.Menu.buildFromTemplate([
      {
        type: "normal",
        label: "Show Sunbeam",
        accelerator,
        click: () => {
          win.show();
        },
      },
      { type: "separator" },
      {
        type: "normal",
        label: "Manual",
        click: () =>
          electron.shell.openExternal(
            "https://sunbeamlauncher.github.io/sunbeam"
          ),
      },
      {
        type: "normal",
        label: "Report Bug",
        click: () =>
          electron.shell.openExternal(
            "http://github.com/sunbeamlauncher/sunbeam/issues/new"
          ),
      },
      { type: "separator" },
      { type: "normal", label: "Quit", click: () => electron.app.quit() },
    ])
  );

  return tray;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerShortcut(win) {
  electron.globalShortcut.register(accelerator, async () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      const centerBounds = getCenterOnCurrentScreen();
      const winBounds = win.getBounds();
      if (winBounds.x !== centerBounds.x || winBounds.y !== centerBounds.y) {
        win.setBounds(centerBounds);
      }

      await sleep(100);
      win.show();
    }
  });
}

const findDefaultShell = () => {
  if (process.platform === "win32") {
    return "bash.exe";
  }
  if (process.env.SHELL) {
    return process.env.SHELL;
  }
  return "bash";
};

electron.app.whenReady().then(async () => {
  electron.ipcMain.handle("theme", () => {
    return {
      dark: "tomorrow-night",
      light: "tomorrow",
    };
  });

  electron.Menu.setApplicationMenu(null);

  console.log("Creating window");
  const win = createWindow();
  console.log("Registering shortcut");
  registerShortcut(win);
  console.log("Creating tray");
  createTray(win);

  console.log("Waiting for ready");
  await new Promise((resolve) => {
    electron.ipcMain.handleOnce("ready", resolve);
  });

  const shell = findDefaultShell();
  let [ptyCols, ptyRows] = [-1, -1];
  while (true) {
    const { exitCode, signal } = await new Promise<{
      exitCode: number;
      signal?: number;
    }>((resolve) => {
      const ptyProcess = pty.spawn(shell, ["-lic", "sunbeam"], {
        env: {
          ...process.env,
          TERM: "xterm-256color",
        },
      });

      if (ptyCols !== -1 || ptyRows !== -1) {
        ptyProcess.resize(ptyCols, ptyRows);
      }

      const onWillQuit = () => {
        ptyProcess.kill();
      };
      electron.app.on("will-quit", onWillQuit);

      const disposable = ptyProcess.onData((data) => {
        win.webContents.send("pty-output", data);
      });

      electron.ipcMain.handle("pty-input", async (_, data) => {
        ptyProcess.write(data);
      });

      electron.ipcMain.handle("pty-resize", async (_, cols, rows) => {
        ptyCols = cols;
        ptyRows = rows;
        ptyProcess.resize(cols, rows);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        disposable.dispose();
        electron.ipcMain.removeHandler("pty-input");
        electron.ipcMain.removeHandler("pty-resize");
        electron.app.removeListener("will-quit", onWillQuit);

        return resolve({ exitCode, signal });
      });
    });

    console.log(`Sunbeam exited with code ${exitCode} and signal ${signal}`);
    if (exitCode != 0 || signal != 0) {
      break;
    }
    win.hide();
    win.webContents.send("pty-exited");
  }
});

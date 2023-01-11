const {
  app,
  BrowserWindow,
  globalShortcut,
  clipboard,
  screen,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeTheme,
} = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const portfinder = require("portfinder");
const minimist = require("minimist");
const fetch = require("node-fetch");
const { parse } = require("url");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
const accelerator = "CommandOrControl+;";

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  console.log("Sunbeam is already running");
  app.quit();
  process.exit(0);
}

app.on("window-all-closed", () => {
  app.quit();
});

if (process.platform === "darwin") {
  app.dock.hide();
}

function createWindow(theme) {
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
    resizable: false,
    type: "panel",
    hasShadow: true,
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? theme.dark.background
      : theme.light.background,
  });

  win.loadFile(path.join(__dirname, "index.html"));

  nativeTheme.on("updated", () => {
    win.setBackgroundColor(
      nativeTheme.shouldUseDarkColors
        ? theme.dark.background
        : theme.light.background
    );
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  ipcMain.handle("hideWindow", () => {
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

function createTray(win) {
  const tray = new Tray(
    path.join(__dirname, "..", "assets", "tray-Template.png")
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        type: "normal",
        label: "Open Sunbeam",
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
          shell.openExternal("https://sunbeamlauncher.github.io/sunbeam"),
      },
      {
        type: "normal",
        label: "Report Bug",
        click: () =>
          shell.openExternal(
            "http://github.com/sunbeamlauncher/sunbeam/issues/new"
          ),
      },
      { type: "separator" },
      { type: "normal", label: "Quit", click: () => app.quit() },
    ])
  );

  return tray;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startSunbeam(host, port) {
  const shell = findDefaultShell();
  return new Promise((resolve, reject) => {
    const sunbeamProcess = child_process.spawn(
      shell,
      ["-lic", `sunbeam listen --host ${host} --port ${port}`],
      {
        env: {
          ...process.env,
          TERM: "xterm-256color",
        },
      }
    );

    sunbeamProcess.stdout.on("data", (data) => {
      console.log(`Sunbeam: ${data}`);
    });

    sunbeamProcess.stderr.on("data", (data) => {
      console.error(`Sunbeam: ${data}`);
    });

    let exited = false;
    let running = true;

    onWillQuit = () => {
      sunbeamProcess.kill();
    };
    app.on("will-quit", onWillQuit);

    sunbeamProcess.on("exit", (code, signal) => {
      exited = true;

      if (signal === "SIGINT") {
        app.removeListener("will-quit", onWillQuit);
        app.quit();
      } else {
        console.log(`Sunbeam exited with code ${code} and signal ${signal}`);
        reject(`Sunbeam exited with signal ${signal}`);
      }
    });

    sunbeamProcess.on("spawn", async () => {
      while (!exited) {
        console.log("Waiting for Sunbeam to start...");
        await sleep(1000);
        try {
          const res = await fetch(`http://${host}:${port}`);
          if (res.status === 200) {
            running = true;
            resolve(`${host}:${port}`);
            break;
          }
        } catch (e) {
          console.log("Sunbeam not started yet");
        }
      }
    });
  });
}

function registerShortcut(win) {
  globalShortcut.register(accelerator, async () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      const centerBounds = getCenterOnCurrentScreen();
      const winBounds = win.getBounds();
      if (winBounds.x !== centerBounds.x || winBounds.y !== centerBounds.y) {
        win.setBounds(centerBounds);
      }
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

app.whenReady().then(async () => {
  const args = minimist(process.argv.slice(2));

  const themeDir = path.join(__dirname, "..", "themes");
  var theme = {
    dark: JSON.parse(
      fs.readFileSync(path.join(themeDir, "tomorrow-night.json"), "utf-8")
    ),
    light: JSON.parse(
      fs.readFileSync(path.join(themeDir, "tomorrow.json"), "utf-8")
    ),
  };

  ipcMain.handle("theme", async () => {
    return theme;
  });

  try {
    let { remote: address } = args;

    if (!address) {
      const port = await portfinder.getPortPromise();
      address = await startSunbeam("localhost", port);
    }

    ipcMain.handle("address", async () => {
      return address;
    });

    ipcMain.handle("open", (_, url) => {
      const { protocol, path } = parse(url);

      switch (protocol) {
        case "fs:":
          const [host, _] = address.split(":");
          if (host !== "localhost" && host !== "0.0.0.0") {
            console.error("Cannot open local file on remote host");
            return;
          }
          shell.openPath(path);
          break;
        default:
          shell.openExternal(url);
          break;
      }
    });

    ipcMain.handle("copy", (_, text) => {
      clipboard.writeText(text);
    });
  } catch (e) {
    console.error(e);
  }

  Menu.setApplicationMenu(null);
  const win = createWindow(theme);
  registerShortcut(win);
  createTray(win);
});

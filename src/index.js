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
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const { lookpath } = require("lookpath");
const download = require("download");
const { Octokit } = require("octokit");
const portfinder = require("portfinder");
const minimist = require("minimist");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

app.on("window-all-closed", () => {
  app.quit();
});

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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    resizable: false,
    type: "panel",
    hasShadow: true,
    backgroundColor: theme.background,
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, "index.html"));

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
      { type: "normal", label: "Show Sunbeam", click: () => win.show() },
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
    ])
  );

  return tray;
}

async function downloadSunbeam() {
  const octokit = new Octokit();

  const res = await octokit.request(
    "GET /repos/{owner}/{repo}/releases/latest",
    {
      owner: "sunbeamlauncher",
      repo: "sunbeam",
    }
  );

  const release = res.data.assets.find(
    (asset) =>
      asset.name.toLowerCase().includes(process.platform) &&
      asset.name.toLowerCase().includes(process.arch)
  );

  if (!release) {
    console.error("No release found for your platform");
    process.exit(1);
  }

  const dist = path.join(os.tmpdir(), release.name);
  await download(release.browser_download_url, dist, { extract: true });

  const sunbeamPath = path.join(os.homedir(), ".local", "bin", "sunbeam");
  fs.renameSync(path.join(dist, "sunbeam"), sunbeamPath);

  fs.rmSync(dist, { recursive: true, force: true });

  return sunbeamPath;
}

async function startSunbeam(host, port) {
  // start sunbeam process

  const binPath = path.join(os.homedir(), ".local", "bin");
  let sunbeamPath = await lookpath("sunbeam", {
    include: [binPath],
  });

  if (!sunbeamPath) {
    console.log("Sunbeam not found, downloading...");
    sunbeamPath = await downloadSunbeam();
  }

  return new Promise((resolve) => {
    const sunbeamProcess = child_process.spawn(
      sunbeamPath,
      ["serve", "--host", host, "--port", port],
      {}
    );

    sunbeamProcess.on("exit", () => {
      console.log("Sunbeam exited");
      app.quit();
    });

    sunbeamProcess.on("spawn", () => {
      resolve();
    });
  });
}

function registerShortcut(win) {
  globalShortcut.register("CommandOrControl+;", async () => {
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

app.whenReady().then(async () => {
  const {
    theme: themeName = "tomorrow-night",
    host = "localhost",
    port = await portfinder.getPortPromise(),
  } = minimist(process.argv.slice(2));

  const themeDir = path.join(__dirname, "..", "themes");
  const themePath = path.join(themeDir, `${themeName}.json`);
  var theme = {};
  if (fs.existsSync(themePath)) {
    theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));
  } else {
    theme = JSON.parse(
      fs.readFileSync(path.join(themeDir, "tomorrow-night.json"), "utf-8")
    );
  }

  ipcMain.handle("theme", async () => {
    return theme;
  });

  ipcMain.handle("address", async () => {
    return `${host}:${port}`;
  });

  await startSunbeam(host, port);
  const win = createWindow(theme);
  createTray(win);

  registerShortcut(win);
});

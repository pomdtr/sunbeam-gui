process.env.NODE_ENV = "development";

const vite = require("vite");
const child_process = require("child_process");
const path = require("path");
const chokidar = require("chokidar");
const electron = require("electron");
const ts = require("./private/tsc");
const fs = require("fs");

let viteServer = null;
let electronProcess = null;
let electronProcessLocker = false;
let rendererPort = 0;

async function startRenderer() {
  viteServer = await vite.createServer({
    configFile: path.join(__dirname, "..", "vite.config.js"),
    mode: "development",
  });

  return viteServer.listen();
}

async function startElectron() {
  if (electronProcess) {
    // single instance lock
    return;
  }

  try {
    await ts.compile(path.join(__dirname, "..", "src", "main"));
  } catch {
    console.log(
      "Could not start Electron because of the above typescript error(s)."
    );
    electronProcessLocker = false;
    return;
  }

  const args = [
    path.join(__dirname, "..", "build", "main", "main.js"),
    rendererPort,
  ];
  electronProcess = child_process.spawn(electron, args);
  electronProcessLocker = false;

  electronProcess.stdout.on("data", (data) =>
    process.stdout.write(`[electron] ${data.toString()}`)
  );

  electronProcess.stderr.on("data", (data) =>
    process.stderr.write(`[electron] ${data}`)
  );

  electronProcess.on("exit", () => stop());
}

function restartElectron() {
  if (electronProcess) {
    electronProcess.removeAllListeners("exit");
    electronProcess.kill();
    electronProcess = null;
  }

  if (!electronProcessLocker) {
    electronProcessLocker = true;
    startElectron();
  }
}

function copyStaticFiles() {
  copy("static");
}

/*
The working dir of Electron is build/main instead of src/main because of TS.
tsc does not copy static files, so copy them over manually for dev server.
*/
function copy(filepath) {
  fs.cpSync(
    path.join(__dirname, "..", "src", "main", filepath),
    path.join(__dirname, "..", "build", "main", filepath),
    { recursive: true }
  );
}

function stop() {
  viteServer.close();
  process.exit();
}

async function start() {
  console.log("=======================================");
  console.log("Starting Electron + Vite Dev Server...");
  console.log("=======================================");

  const devServer = await startRenderer();
  rendererPort = devServer.config.server.port;

  copyStaticFiles();
  startElectron();

  const dir = path.join(__dirname, "..", "src", "main");
  chokidar
    .watch(dir, {
      cwd: dir,
    })
    .on("change", (filepath) => {
      console.log(`[electron] Change in ${filepath}. reloading... 🚀`);

      if (filepath.startsWith(path.join("static", "/"))) {
        copy(filepath);
      }

      restartElectron();
    });
}

start();

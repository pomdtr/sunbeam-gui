const path = require("path");
const fs = require("fs");
const vite = require("vite");
const ts = require("./private/tsc");

function buildRenderer() {
  return vite.build({
    configFile: path.join(__dirname, "..", "vite.config.js"),
    base: "./",
    mode: "production",
  });
}

function buildMain() {
  const mainPath = path.join(__dirname, "..", "src", "main");
  return ts.compile(mainPath);
}

fs.rmSync(path.join(__dirname, "..", "build"), {
  recursive: true,
  force: true,
});

console.log("Transpiling renderer & main...");

Promise.allSettled([buildRenderer(), buildMain()]).then(() => {
  console.log(
    "Renderer & main successfully transpiled! (ready to be built with electron-builder)"
  );
});

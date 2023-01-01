const path = require("path");
const os = require("os");
const child_process = require("child_process");
const GOPATH = process.env.GOPATH || path.join(os.homedir(), "go", "bin");

module.exports = {
  packagerConfig: {
    extraResource: [path.join(GOPATH, "sunbeam")],
    icon: path.join(__dirname, "assets", "icon"),
  },
  hooks: {
    generateAssets: async () => {
      await child_process.execSync("./scripts/refresh-themes.mjs");
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
};

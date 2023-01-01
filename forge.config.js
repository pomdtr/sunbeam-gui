const path = require("path");
const os = require("os");
const GOPATH = process.env.GOPATH || path.join(os.homedir(), "go", "bin");

module.exports = {
  packagerConfig: {
    extraResource: [path.join(GOPATH, "sunbeam")],
    icon: path.join(__dirname, "assets", "icon"),
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
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

const path = require("path");

const { defineConfig } = require("vite");

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
  root: path.join(__dirname, "src", "renderer"),
  publicDir: "public",
  server: {
    port: 8080,
  },
  open: false,
  build: {
    outDir: path.join(__dirname, "build", "renderer"),
    emptyOutDir: true,
  },
});

module.exports = config;

async function loadTheme(theme) {
  if (!theme) {
    return undefined;
  }
  try {
    const res = await fetch(`../themes/${theme}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load theme ${theme}`);
    }
    return res.json();
  } catch (e) {
    console.error("Failed to load theme", e);
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const terminalElement = document.getElementById("terminal");
const themeName = terminalElement.getAttribute("data-sunbeam-theme");
const theme = await loadTheme(themeName);

const terminal = new Terminal({
  allowTransparency: true,
  macOptionIsMeta: true,
  cursorBlink: true,
  cursorStyle: "block",
  fontSize: 13,
  scrollback: 0,
  fontFamily: "Consolas,Liberation Mono,Menlo,Courier,monospace",
  theme,
});

const fitAddon = new FitAddon.FitAddon();
// const canvasAddon = new CanvasAddon();
const webglAddon = new WebglAddon.WebglAddon();
const webLinksAddon = new WebLinksAddon.WebLinksAddon((_, url) => {
  window.electron.openInBrowser(url);
});

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
terminal.open(document.getElementById("terminal"));

terminal.loadAddon(fitAddon);
// terminal.loadAddon(canvasAddon);
terminal.loadAddon(webglAddon);

terminal.loadAddon(webLinksAddon);
terminal.focus();

window.pty.onData((data) => {
  terminal.write(data);
});

let [rows, cols] = [0, 0];
terminal.onResize((dimensions) => {
  rows = dimensions.rows;
  cols = dimensions.cols;
  window.pty.resize(cols, rows);
});

window.pty.onReady(() => {
  window.pty.resize(cols, rows);
});

terminal.onData((data) => {
  window.pty.write(data);
});

fitAddon.fit();

const theme = await window.sunbeam.getTheme();
const terminal = new Terminal({
  macOptionIsMeta: true,
  fontSize: 13,
  scrollback: 0,
  fontFamily: "Consolas,Liberation Mono,Menlo,Courier,monospace",
  theme,
});

const fitAddon = new FitAddon.FitAddon();
// const canvasAddon = new CanvasAddon.CanvasAddon();
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

webglAddon.onContextLoss(() => {
  location.reload();
});

window.pty.onExit(() => {
  terminal.clear();
});

window.pty.onReady(() => {
  window.pty.resize(cols, rows);
});

terminal.onData((data) => {
  window.pty.write(data);
});

fitAddon.fit();

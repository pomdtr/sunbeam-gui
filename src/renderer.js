async function loadTheme(theme) {
  return undefined;
  if (!theme) {
    return undefined;
  }
  const res = await fetch(`./themes/${theme}.json`);
  if (res.ok) {
    return res.json();
  } else {
    const error = await res.text();
    console.error("Failed to load theme", error);
    return undefined;
  }
}

async function main() {
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

  window.pty.onData((data) => {
    console.log("pty -> terminal");
    terminal.write(data);
  });

  let [rows, cols] = [0, 0];
  terminal.onResize((dimensions) => {
    console.log("Resizing pty");
    rows = dimensions.rows;
    cols = dimensions.cols;
    window.pty.resize(cols, rows);
  });

  window.pty.onReady(() => {
    window.pty.resize(cols, rows);
  });

  terminal.onData((data) => {
    console.log("terminal -> pty");
    window.pty.write(data);
  });

  fitAddon.fit();
}

main();

const theme = await window.electron.getTheme();
const address = await window.electron.getAddress();

const terminal = new Terminal({
  macOptionIsMeta: true,
  fontSize: 13,
  scrollback: 0,
  fontFamily: '"Cascadia Code", Menlo, monospace',
  theme,
});

const ws = new WebSocket(`ws://${address}/ws`);

const fitAddon = new FitAddon.FitAddon();
const webglAddon = new WebglAddon.WebglAddon();
const webLinksAddon = new WebLinksAddon.WebLinksAddon((_, url) => {
  window.electron.openInBrowser(url);
});
const attachAddon = new AttachAddon.AttachAddon(ws);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
terminal.open(document.getElementById("terminal"));

terminal.loadAddon(fitAddon);
terminal.loadAddon(webglAddon);

terminal.loadAddon(webLinksAddon);
terminal.loadAddon(attachAddon);
terminal.focus();

webglAddon.onContextLoss(() => {
  location.reload();
});

terminal.onResize(({ rows, cols }) => {
  console.log("resize", rows, cols);
  const payload = new TextEncoder().encode(JSON.stringify({ rows, cols }));
  ws.send(payload);
});

window.onresize = () => {
  fitAddon.fit();
};

ws.onopen = () => {
  terminal.focus();
  fitAddon.fit();
};

ws.onclose = () => {
  window.electron.hideWindow();
  location.reload();
};

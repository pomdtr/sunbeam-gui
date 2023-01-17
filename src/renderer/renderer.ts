import { Terminal, ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { WebglAddon } from "xterm-addon-webgl";

declare global {
  interface Window {
    electron: {
      getTheme: () => { dark: any; light: any };
      ready: () => void;
      sendToPty: (data: string) => void;
      onPtyData: (callback: (data: any) => void) => void;
      onExit: (callback: () => void) => void;
      resizePty: (cols: number, rows: number) => void;
    };
  }
}

async function main() {
  const themes = import.meta.glob<ITheme>("./themes/*.json");
  const themeDark = await themes["./themes/tomorrow-night.json"]();
  const themeLight = await themes["./themes/tomorrow.json"]();

  const terminal = new Terminal({
    macOptionIsMeta: true,
    fontSize: 13,
    scrollback: 0,
    fontFamily: '"Cascadia Code", Menlo, monospace',
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? themeDark
      : themeLight,
  });

  const fitAddon = new FitAddon();
  const webglAddon = new WebglAddon();
  const webLinksAddon = new WebLinksAddon((_, url) => {
    window.open(url, "_blank");
  });

  terminal.open(document.getElementById("terminal")!);

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webglAddon);
  terminal.loadAddon(webLinksAddon);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function (e) {
      const newColorScheme = e.matches ? "dark" : "light";
      terminal.options.theme = e.matches ? themeDark : themeLight;
      console.log("new color scheme", newColorScheme);
    });

  try {
    terminal.onData((data) => {
      window.electron.sendToPty(data);
    });

    window.electron.onPtyData((data) => {
      terminal.write(data);
    });

    window.electron.onExit(() => {
      terminal.clear();
    });

    terminal.onResize(({ cols, rows }) => {
      console.log("resize", cols, rows);
      window.electron.resizePty(cols, rows);
    });

    window.onresize = () => {
      fitAddon.fit();
    };
  } catch (e) {
    terminal.write(
      "Sunbeam not found! Please install sunbeam and setup your shell."
    );
  }

  window.electron.ready();

  fitAddon.fit();
  terminal.focus();
}

main();

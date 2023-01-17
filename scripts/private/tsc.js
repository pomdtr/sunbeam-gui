const ChildProcess = require("child_process");

function compile(directory) {
  return new Promise((resolve, reject) => {
    const tscProcess = ChildProcess.exec("tsc", {
      cwd: directory,
    });

    tscProcess.stdout.on("data", (data) =>
      process.stdout.write(`[tsc] ${data}`)
    );

    tscProcess.on("exit", (exitCode) => {
      if (exitCode > 0) {
        reject(exitCode);
      } else {
        resolve();
      }
    });
  });
}

module.exports = { compile };

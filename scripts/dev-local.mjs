import { spawn } from "node:child_process";
// Local persistence is an explicit mode, never a silent cloud-failure fallback.
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
  { stdio: "inherit", env: { ...process.env, ILQUE_STORAGE: "file" } },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

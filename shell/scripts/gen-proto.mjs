import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "src/proto");
const contracts = resolve(root, "../contracts");
const pluginName = process.platform === "win32"
  ? "node_modules/.bin/protoc-gen-es.cmd"
  : "node_modules/.bin/protoc-gen-es";
const plugin = resolve(root, pluginName);

mkdirSync(output, { recursive: true });

const protoc = process.platform === "win32" ? "protoc.exe" : "protoc";
const result = spawnSync(protoc, [
  `--plugin=protoc-gen-es=${plugin}`,
  `--es_out=${output}`,
  "--es_opt=target=ts",
  `--proto_path=${contracts}`,
  "seal.proto",
], { cwd: contracts, stdio: "inherit" });

if (result.error) {
  console.error(`Unable to run ${protoc}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

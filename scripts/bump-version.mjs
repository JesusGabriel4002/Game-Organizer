// Usage: npm run bump -- 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Informe a nova versão no formato X.Y.Z, ex.: npm run bump -- 0.2.0");
  process.exit(1);
}

const updateJson = (file) => {
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = version;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
};

updateJson("package.json");
updateJson("src-tauri/tauri.conf.json");

const cargoFile = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoFile, "utf8").replace(/^version = "[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoFile, cargo);

console.log(`Versão atualizada para ${version} em package.json, tauri.conf.json e Cargo.toml.`);
console.log(`Próximo passo: git commit -am "v${version}" && git tag v${version} && git push origin main --tags`);

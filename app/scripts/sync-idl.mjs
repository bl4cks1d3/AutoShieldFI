// Copia o IDL e os tipos gerados pelo `anchor build` para o frontend.
import { copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
copyFileSync(resolve(root, "target/idl/autoshield.json"), resolve(root, "app/src/idl/autoshield.json"));
copyFileSync(resolve(root, "target/types/autoshield.ts"), resolve(root, "app/src/idl/autoshield.ts"));
console.log("IDL sincronizado em app/src/idl/");

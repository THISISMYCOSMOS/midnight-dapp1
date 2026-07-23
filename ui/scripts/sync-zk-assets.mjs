// SPDX-License-Identifier: Apache-2.0

import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const managedDirectory = new URL(
  "../../contract/src/managed/review/",
  import.meta.url,
);

mkdirSync(publicDirectory, { recursive: true });

for (const directory of ["keys", "zkir"]) {
  cpSync(
    fileURLToPath(new URL(directory, managedDirectory)),
    fileURLToPath(new URL(`../public/${directory}`, import.meta.url)),
    { recursive: true, force: true },
  );
}

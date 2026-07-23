// SPDX-License-Identifier: Apache-2.0

import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const contractRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceManaged = fileURLToPath(
  new URL("../src/managed", import.meta.url),
);
const targetManaged = fileURLToPath(
  new URL("../dist/managed", import.meta.url),
);
const sourceContract = fileURLToPath(
  new URL("../src/review.compact", import.meta.url),
);
const targetContract = fileURLToPath(
  new URL("../dist/review.compact", import.meta.url),
);

mkdirSync(contractRoot, { recursive: true });
cpSync(sourceManaged, targetManaged, { recursive: true, force: true });
cpSync(sourceContract, targetContract, { force: true });

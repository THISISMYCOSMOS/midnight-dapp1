// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pureCircuits } from "../contract/dist/index.js";

const localDataRoot =
  process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share");
const projectRoot = resolve(import.meta.dirname, "..");
const reviewerDataRoot = join(
  localDataRoot,
  "midnight-review",
  "reviewers",
);

const toHex = (value) => Buffer.from(value).toString("hex");
const validName = (value) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(value);

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const reviewerName = argument("--name");
if (!reviewerName || !validName(reviewerName)) {
  throw new Error(
    "--name은 영문·숫자·밑줄·하이픈으로 된 1~40자 이름이어야 합니다",
  );
}

const secretFile = resolve(
  argument("--secret-file") ??
    join(reviewerDataRoot, reviewerName, "reviewer-secret.hex"),
);

const assertOutsideProject = async () => {
  const project = await realpath(projectRoot);
  const targetParent = await realpath(dirname(secretFile)).catch(() =>
    Promise.resolve(resolve(dirname(secretFile))),
  );
  const relation = relative(project, targetParent);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    throw new Error("리뷰어 비밀키는 프로젝트 저장소 밖에 보관해야 합니다");
  }
};

const loadOrCreateSecret = async () => {
  await mkdir(dirname(secretFile), { recursive: true });
  await assertOutsideProject();

  try {
    const existing = (await readFile(secretFile, "utf8")).trim();
    if (!/^[0-9a-f]{64}$/.test(existing)) {
      throw new Error(`비밀키 파일 형식이 잘못되었습니다: ${secretFile}`);
    }
    return Buffer.from(existing, "hex");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generated = randomBytes(32);
  await writeFile(secretFile, toHex(generated), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return generated;
};

const secret = await loadOrCreateSecret();
const reviewerKey = pureCircuits.deriveReviewerKey(secret);
const fileInfo = await stat(secretFile);

process.stdout.write(
  `${JSON.stringify(
    {
      reviewerKey: toHex(reviewerKey),
      secretFile,
      secretPrinted: false,
      secretBytes: fileInfo.size / 2,
    },
    null,
    2,
  )}\n`,
);

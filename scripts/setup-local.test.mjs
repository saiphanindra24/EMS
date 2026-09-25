import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setupLocalEnvironment } from "./setup-local.mjs";

async function withTemporaryProject(callback) {
  const root = await mkdtemp(join(tmpdir(), "volksskatt-setup-"));
  try {
    await copyFile(new URL("../.env.example", import.meta.url), join(root, ".env.example"));
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function readValue(content, name) {
  return content.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1];
}

test("creates matching local database credentials and a strong JWT secret", async () => {
  await withTemporaryProject(async (root) => {
    const result = await setupLocalEnvironment(root);
    assert.equal(result.created, true);
    const content = await readFile(join(root, ".env"), "utf8");
    const password = readValue(content, "POSTGRES_PASSWORD");
    const jwtSecret = readValue(content, "JWT_SECRET");
    assert.match(password, /^[a-f0-9]{48}$/);
    assert.match(jwtSecret, /^[a-f0-9]{64}$/);
    assert.notEqual(password, jwtSecret);
    const url = new URL(readValue(content, "DATABASE_URL"));
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.username, "postgres");
    assert.equal(url.password, password);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "5432");
    assert.equal(url.pathname, "/app_db");
  });
});

test("running setup twice does not rotate credentials", async () => {
  await withTemporaryProject(async (root) => {
    await setupLocalEnvironment(root);
    const before = await readFile(join(root, ".env"), "utf8");
    assert.equal((await setupLocalEnvironment(root)).created, false);
    assert.equal(await readFile(join(root, ".env"), "utf8"), before);
  });
});

test("preserves an existing custom or preview environment byte-for-byte", async () => {
  await withTemporaryProject(async (root) => {
    const existing = "# Existing configuration\nDATABASE_URL=custom-existing-value\n";
    await writeFile(join(root, ".env"), existing);
    assert.equal((await setupLocalEnvironment(root)).created, false);
    assert.equal(await readFile(join(root, ".env"), "utf8"), existing);
  });
});

test("generates different credentials for different local projects", async () => {
  await withTemporaryProject(async (first) => {
    await withTemporaryProject(async (second) => {
      await setupLocalEnvironment(first);
      await setupLocalEnvironment(second);
      const a = await readFile(join(first, ".env"), "utf8");
      const b = await readFile(join(second, ".env"), "utf8");
      assert.notEqual(readValue(a, "POSTGRES_PASSWORD"), readValue(b, "POSTGRES_PASSWORD"));
      assert.notEqual(readValue(a, "JWT_SECRET"), readValue(b, "JWT_SECRET"));
    });
  });
});

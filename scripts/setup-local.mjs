import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Create local development configuration from .env.example.
 * Existing configuration is never changed, including on repeated invocations.
 * No credentials are printed to the terminal.
 */
export async function setupLocalEnvironment(projectDirectory) {
  const envPath = join(projectDirectory, ".env");
  try {
    await access(envPath);
    return { created: false, envPath };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const template = await readFile(join(projectDirectory, ".env.example"), "utf8");
  const databasePassword = randomBytes(24).toString("hex");
  const jwtSecret = randomBytes(32).toString("hex");
  const databaseUrl = `postgresql://postgres:${databasePassword}@127.0.0.1:5432/app_db`;
  const values = {
    POSTGRES_PASSWORD: databasePassword,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
  };

  let content = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = new RegExp(`^${key}=[\\t ]*\\r?$`, "m");
    if (!placeholder.test(content)) {
      throw new Error(`Expected an empty ${key}= entry in .env.example`);
    }
    content = content.replace(placeholder, `${key}=${value}`);
  }

  try {
    // Exclusive creation also protects against a concurrent setup invocation.
    await writeFile(envPath, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST") return { created: false, envPath };
    throw error;
  }
  return { created: true, envPath };
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    const root = resolve(dirname(scriptPath), "..");
    const result = await setupLocalEnvironment(root);
    if (result.created) {
      console.log("Created .env with unique local PostgreSQL and JWT credentials.");
      console.log("Keep this file private; it is excluded from Git.");
      console.log("Next: docker compose up -d --wait");
      console.log("Then: npx drizzle-kit push");
      console.log("Then: npx tsx scripts/seed.ts");
      console.log("Finally: npm run dev");
    } else {
      console.log("An .env file already exists. No values were changed.");
      console.log("Review DATABASE_URL and JWT_SECRET before starting.");
      console.log("For Docker, POSTGRES_PASSWORD must match the password in DATABASE_URL.");
      console.log("See README.md for handling an exported preview configuration.");
    }
  } catch (error) {
    console.error(`Local setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

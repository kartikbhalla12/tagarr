import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { QbitClient } from "./qbit.js";
import { processTorrents } from "./tagger.js";

const RETRY_MS = 30_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run(env = process.env, log = console) {
  const config = loadConfig(env);
  const client = new QbitClient({
    url: config.qbitUrl,
    username: config.username,
    password: config.password,
  });

  log.info?.("Configured tracker rules:");
  for (const rule of config.rules) {
    log.info?.(`  ${rule.match} -> ${rule.tag}`);
  }

  while (true) {
    try {
      await client.login();
      log.info?.("Logged into qBittorrent");

      while (true) {
        await processTorrents({ client, rules: config.rules, log });
        await sleep(config.checkIntervalMs);
      }
    } catch (error) {
      log.error?.(`Error: ${error.message}`);
      log.info?.("Retrying in 30 seconds...");
      await sleep(RETRY_MS);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

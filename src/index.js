import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { QbitClient } from "./qbit.js";
import { processTorrents } from "./tagger.js";

const RETRY_MS = 30_000;

export function sleep(ms, signal) {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);

    const onAbort = () => {
      clearTimeout(timer);
      finish();
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    function finish() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
  });
}

export async function run(
  env = process.env,
  log = createLogger(),
  {
    signal,
    createClient = (config) =>
      new QbitClient({
        url: config.qbitUrl,
        username: config.username,
        password: config.password,
      }),
  } = {}
) {
  const config = loadConfig(env);
  const client = createClient(config);

  log.info("Starting tagarr", {
    url: config.qbitUrl,
    interval: `${config.checkIntervalMs / 1000}s`,
    username: config.username || "<empty>",
    password: config.password ? "set" : "empty",
  });

  for (const rule of config.rules) {
    log.info("Loaded tracker rule", { match: rule.match, tag: rule.tag });
  }

  while (!signal?.aborted) {
    try {
      await client.login();
      if (signal?.aborted) {
        break;
      }

      log.info("Logged into qBittorrent", { url: config.qbitUrl });

      while (!signal?.aborted) {
        await processTorrents({ client, rules: config.rules, log });
        await sleep(config.checkIntervalMs, signal);
      }
    } catch (error) {
      if (signal?.aborted) {
        break;
      }

      log.error("qBittorrent request failed", { url: config.qbitUrl, error });
      log.info("Retrying in 30 seconds");
      await sleep(RETRY_MS, signal);
    }
  }

  log.info("Shutting down");
}

function listenForShutdown(log, controller) {
  const onSignal = (signal) => {
    log.info("Received shutdown signal", { signal });
    controller.abort();
  };

  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("SIGINT", () => onSignal("SIGINT"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const log = createLogger();
  const controller = new AbortController();
  listenForShutdown(log, controller);

  run(process.env, log, { signal: controller.signal }).catch((error) => {
    log.error("Tagarr exited", { error });
    process.exit(1);
  });
}

import { parseRules } from "./rules.js";

export function loadConfig(env = process.env) {
  const qbitUrl = String(env.QBIT_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!qbitUrl) {
    throw new Error("QBIT_URL is required");
  }

  const rules = parseRules(env.TRACKER_TAG_RULES);
  if (rules.length === 0) {
    throw new Error("TRACKER_TAG_RULES must contain at least one valid rule");
  }

  const intervalSeconds = Number.parseInt(env.CHECK_INTERVAL ?? "60", 10);

  return {
    qbitUrl,
    username: env.QBIT_USERNAME ?? "",
    password: env.QBIT_PASSWORD ?? "",
    checkIntervalMs: Number.isFinite(intervalSeconds) && intervalSeconds > 0
      ? intervalSeconds * 1000
      : 60_000,
    rules,
  };
}

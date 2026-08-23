import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const validRules = JSON.stringify([
  { match: "example", tag: "example" },
]);

describe("loadConfig", () => {
  it("loads compose environment values", () => {
    const config = loadConfig({
      QBIT_URL: "http://qbittorrent:8080/",
      QBIT_USERNAME: "admin",
      QBIT_PASSWORD: "secret",
      CHECK_INTERVAL: "15",
      TRACKER_TAG_RULES: validRules,
    });

    assert.deepEqual(config, {
      qbitUrl: "http://qbittorrent:8080",
      username: "admin",
      password: "secret",
      checkIntervalMs: 15_000,
      rules: [{ match: "example", tag: "example" }],
    });
  });

  it("requires QBIT_URL", () => {
    assert.throws(
      () =>
        loadConfig({
          TRACKER_TAG_RULES: validRules,
        }),
      /QBIT_URL is required/
    );
  });

  it("requires at least one tracker rule", () => {
    assert.throws(
      () =>
        loadConfig({
          QBIT_URL: "http://qbittorrent:8080",
          TRACKER_TAG_RULES: "[]",
        }),
      /at least one valid rule/
    );
  });

  it("trims qBittorrent credentials", () => {
    const config = loadConfig({
      QBIT_URL: "http://qbittorrent:8080",
      QBIT_USERNAME: " admin \n",
      QBIT_PASSWORD: " secret\n",
      TRACKER_TAG_RULES: validRules,
    });

    assert.equal(config.username, "admin");
    assert.equal(config.password, "secret");
  });

  it("defaults the check interval to 60 seconds", () => {
    const config = loadConfig({
      QBIT_URL: "http://qbittorrent:8080",
      TRACKER_TAG_RULES: validRules,
    });

    assert.equal(config.checkIntervalMs, 60_000);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sleep, run } from "../src/index.js";

describe("sleep", () => {
  it("returns immediately when the abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const started = Date.now();
    await sleep(5_000, controller.signal);
    assert.ok(Date.now() - started < 100);
  });

  it("stops waiting when aborted mid-sleep", async () => {
    const controller = new AbortController();
    const started = Date.now();

    const waiting = sleep(5_000, controller.signal);
    setTimeout(() => controller.abort(), 20);
    await waiting;

    assert.ok(Date.now() - started < 500);
  });
});

describe("run", () => {
  it("exits the loop on shutdown instead of retrying", async () => {
    const logs = [];
    const controller = new AbortController();

    controller.abort();

    await run(
      {
        QBIT_URL: "http://qbittorrent:8080",
        TRACKER_TAG_RULES: JSON.stringify([
          { match: "tracker.example.com", tag: "example" },
        ]),
      },
      {
        info: (message) => logs.push(message),
        error: (message) => logs.push(message),
      },
      {
        signal: controller.signal,
        createClient: () => ({
          async login() {
            throw new Error("fetch failed");
          },
        }),
      }
    );

    assert.ok(logs.some((message) => message === "Shutting down"));
    assert.equal(
      logs.filter((message) => message === "Retrying in 30 seconds").length,
      0
    );
  });
});

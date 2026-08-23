import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLogger, formatError } from "../src/logger.js";

describe("formatError", () => {
  it("includes the message and nested cause code", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 172.18.0.5:8080"), {
      code: "ECONNREFUSED",
      syscall: "connect",
      address: "172.18.0.5",
      port: 8080,
    });
    const error = new Error("fetch failed", { cause });

    assert.match(formatError(error), /fetch failed/);
    assert.match(formatError(error), /ECONNREFUSED/);
    assert.match(formatError(error), /172\.18\.0\.5:8080/);
  });

  it("stringifies a non-error value", () => {
    assert.equal(formatError("boom"), "boom");
  });
});

describe("createLogger", () => {
  function collect() {
    const stdout = [];
    const stderr = [];
    const log = createLogger({
      color: false,
      now: () => new Date("2026-08-23T07:17:00.000Z"),
      stdout: { write: (line) => stdout.push(line) },
      stderr: { write: (line) => stderr.push(line) },
    });
    return { log, stdout, stderr };
  }

  it("writes timestamped info lines to stdout", () => {
    const { log, stdout } = collect();

    log.info("Logged into qBittorrent", { url: "http://qbittorrent:8080" });

    assert.deepEqual(stdout, [
      '2026-08-23T07:17:00.000Z INFO  Logged into qBittorrent url=http://qbittorrent:8080\n',
    ]);
  });

  it("writes errors to stderr with a formatted cause", () => {
    const { log, stderr } = collect();
    const error = new Error("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND qbittorrent"), {
        code: "ENOTFOUND",
      }),
    });

    log.error("qBittorrent request failed", { error });

    assert.equal(stderr.length, 1);
    assert.match(stderr[0], /^2026-08-23T07:17:00.000Z ERROR qBittorrent request failed /);
    assert.match(stderr[0], /error="fetch failed/);
    assert.match(stderr[0], /ENOTFOUND/);
  });

  it("hides debug lines at the default info level", () => {
    const { log, stdout } = collect();
    log.debug("skip me");
    assert.deepEqual(stdout, []);
  });

  it("writes debug lines when LOG_LEVEL is debug", () => {
    const stdout = [];
    const log = createLogger({
      color: false,
      level: "debug",
      now: () => new Date("2026-08-23T07:17:00.000Z"),
      stdout: { write: (line) => stdout.push(line) },
      stderr: { write() {} },
    });

    log.debug("checking torrent", { hash: "abc" });

    assert.deepEqual(stdout, [
      "2026-08-23T07:17:00.000Z DEBUG checking torrent hash=abc\n",
    ]);
  });

  it("colors info, warn, and error level labels", () => {
    const stdout = [];
    const stderr = [];
    const log = createLogger({
      color: true,
      now: () => new Date("2026-08-23T07:17:00.000Z"),
      stdout: { write: (line) => stdout.push(line) },
      stderr: { write: (line) => stderr.push(line) },
    });

    log.info("up");
    log.warn("careful");
    log.error("down");

    assert.match(stdout[0], /^2026-08-23T07:17:00.000Z \x1b\[36mINFO \x1b\[0m up/);
    assert.match(stdout[1], /\x1b\[33mWARN \x1b\[0m careful/);
    assert.match(stderr[0], /\x1b\[31mERROR\x1b\[0m down/);
    assert.doesNotMatch(stdout[0], /\x1b\[2m/);
  });
});

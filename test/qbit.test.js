import { createServer } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { QbitClient } from "../src/qbit.js";

function startMockQbit() {
  let sid = "session-1";
  let requireAuth = true;
  const calls = [];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const body = await readBody(req);
    const cookie = req.headers.cookie ?? "";
    const referer = req.headers.referer ?? "";

    calls.push({
      path: url.pathname,
      method: req.method,
      cookie,
      referer,
      body,
    });

    if (url.pathname === "/api/v2/auth/login") {
      const params = new URLSearchParams(body);
      if (
        params.get("username") === "admin" &&
        params.get("password") === "secret"
      ) {
        res.setHeader("Set-Cookie", `SID=${sid}; path=/`);
        res.end("Ok.");
        return;
      }

      res.end("Fails.");
      return;
    }

    if (requireAuth && !cookie.includes(`SID=${sid}`)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    if (url.pathname === "/api/v2/torrents/info") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify([{ hash: "abc", name: "Show", tags: "sonarr" }])
      );
      return;
    }

    if (url.pathname === "/api/v2/torrents/trackers") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify([
          { url: "https://tracker.example.com/announce" },
        ])
      );
      return;
    }

    if (url.pathname === "/api/v2/torrents/addTags") {
      res.end();
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        calls,
        url: `http://127.0.0.1:${port}`,
        expireSession() {
          sid = "session-2";
        },
        disableAuth() {
          requireAuth = false;
        },
      });
    });
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

describe("QbitClient", () => {
  let mock;

  before(async () => {
    mock = await startMockQbit();
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      mock.server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("logs in, sends the SID cookie and Referer, and reads torrents", async () => {
    const client = new QbitClient({
      url: mock.url,
      username: "admin",
      password: "secret",
    });

    await client.login();
    const torrents = await client.getTorrents();

    assert.deepEqual(torrents, [{ hash: "abc", name: "Show", tags: "sonarr" }]);

    const login = mock.calls.find((call) => call.path === "/api/v2/auth/login");
    const info = mock.calls.find((call) => call.path === "/api/v2/torrents/info");

    assert.equal(login.referer, mock.url);
    assert.match(info.cookie, /SID=session-1/);
  });

  it("adds tags through the form API", async () => {
    const client = new QbitClient({
      url: mock.url,
      username: "admin",
      password: "secret",
    });

    await client.login();
    await client.addTags("abc", ["private", "example"]);

    const add = mock.calls.find((call) => call.path === "/api/v2/torrents/addTags");
    const params = new URLSearchParams(add.body);

    assert.equal(params.get("hashes"), "abc");
    assert.equal(params.get("tags"), "private,example");
  });

  it("re-logs in after a 403 session expiry", async () => {
    const client = new QbitClient({
      url: mock.url,
      username: "admin",
      password: "secret",
    });

    await client.login();
    mock.expireSession();

    const torrents = await client.getTorrents();
    assert.equal(torrents[0].hash, "abc");

    const logins = mock.calls.filter((call) => call.path === "/api/v2/auth/login");
    assert.ok(logins.length >= 2);
  });

  it("rejects a failed login", async () => {
    const client = new QbitClient({
      url: mock.url,
      username: "admin",
      password: "wrong",
    });

    await assert.rejects(() => client.login(), /qBittorrent login failed/);
  });

  it("wraps a network failure with the request URL", async () => {
    const client = new QbitClient({
      url: "http://qbittorrent:8080",
      username: "admin",
      password: "secret",
      fetchImpl: async () => {
        throw new Error("fetch failed", {
          cause: Object.assign(new Error("getaddrinfo ENOTFOUND qbittorrent"), {
            code: "ENOTFOUND",
          }),
        });
      },
    });

    await assert.rejects(async () => {
      await client.login();
    }, (error) => {
      assert.match(error.message, /http:\/\/qbittorrent:8080\/api\/v2\/auth\/login/);
      assert.equal(error.cause.message, "fetch failed");
      assert.equal(error.cause.cause.code, "ENOTFOUND");
      return true;
    });
  });
});

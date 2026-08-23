import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processTorrents } from "../src/tagger.js";

function createClient({ torrents, trackersByHash }) {
  const added = [];

  return {
    added,
    async getTorrents() {
      return torrents;
    },
    async getTrackers(hash) {
      return trackersByHash[hash] ?? [];
    },
    async addTags(hash, tags) {
      added.push({ hash, tags });
    },
  };
}

describe("processTorrents", () => {
  const rules = [
    { match: "private", tag: "private" },
    { match: "example.com", tag: "example" },
  ];

  it("adds missing tracker tags and leaves existing tags untouched", async () => {
    const client = createClient({
      torrents: [
        {
          hash: "abc",
          name: "Show.S01E01",
          tags: "sonarr",
        },
      ],
      trackersByHash: {
        abc: [{ url: "https://tracker.private.org/announce" }],
      },
    });

    const logs = [];
    await processTorrents({
      client,
      rules,
      log: { info: (message, fields) => logs.push({ message, fields }) },
    });

    assert.deepEqual(client.added, [
      { hash: "abc", tags: ["private"] },
    ]);
    assert.match(logs[0].message, /Show\.S01E01/);
    assert.equal(logs[0].fields.tags, "private");
  });

  it("does not re-add a tag the torrent already has", async () => {
    const client = createClient({
      torrents: [
        {
          hash: "abc",
          name: "Already Tagged",
          tags: "sonarr, private",
        },
      ],
      trackersByHash: {
        abc: [{ url: "https://tracker.private.org/announce" }],
      },
    });

    await processTorrents({
      client,
      rules,
      log: { info() {}, error() {} },
    });

    assert.deepEqual(client.added, []);
  });

  it("adds every newly matched tag in one call", async () => {
    const client = createClient({
      torrents: [{ hash: "xyz", name: "Movie", tags: "" }],
      trackersByHash: {
        xyz: [
          { url: "https://tracker.private.org/announce" },
          { url: "https://tracker.example.com/announce" },
        ],
      },
    });

    await processTorrents({
      client,
      rules,
      log: { info() {}, error() {} },
    });

    assert.equal(client.added.length, 1);
    assert.equal(client.added[0].hash, "xyz");
    assert.deepEqual(client.added[0].tags.sort(), ["example", "private"]);
  });

  it("continues after a single torrent fails", async () => {
    const client = {
      async getTorrents() {
        return [
          { hash: "bad", name: "Broken", tags: "" },
          { hash: "good", name: "Fine", tags: "" },
        ];
      },
      async getTrackers(hash) {
        if (hash === "bad") {
          throw new Error("tracker lookup failed");
        }
        return [{ url: "https://tracker.example.com/announce" }];
      },
      added: [],
      async addTags(hash, tags) {
        this.added.push({ hash, tags });
      },
    };

    const errors = [];
    await processTorrents({
      client,
      rules,
      log: {
        info() {},
        error: (message) => errors.push(message),
      },
    });

    assert.deepEqual(client.added, [{ hash: "good", tags: ["example"] }]);
    assert.match(errors[0], /Broken/);
  });
});

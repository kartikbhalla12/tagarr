import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRules, findMatchingTags, parseExistingTags } from "../src/rules.js";

describe("parseRules", () => {
  it("returns an empty list when the env value is missing", () => {
    assert.deepEqual(parseRules(undefined), []);
    assert.deepEqual(parseRules(""), []);
  });

  it("parses a JSON array of match/tag rules", () => {
    const rules = parseRules(`
      [
        { "match": "TorrentLeech", "tag": " torrentleech " },
        { "match": "tracker.example.com", "tag": "example" }
      ]
    `);

    assert.deepEqual(rules, [
      { match: "torrentleech", tag: "torrentleech" },
      { match: "tracker.example.com", tag: "example" },
    ]);
  });

  it("drops rules that are missing a match or tag", () => {
    const rules = parseRules(
      JSON.stringify([
        { match: "ok", tag: "ok" },
        { match: "missing-tag" },
        { tag: "missing-match" },
        { match: "  ", tag: "blank" },
      ])
    );

    assert.deepEqual(rules, [{ match: "ok", tag: "ok" }]);
  });

  it("rejects invalid JSON", () => {
    assert.throws(() => parseRules("not-json"), /TRACKER_TAG_RULES/);
  });

  it("rejects a non-array JSON value", () => {
    assert.throws(
      () => parseRules('{"match":"x","tag":"y"}'),
      /TRACKER_TAG_RULES must be a JSON array/
    );
  });
});

describe("findMatchingTags", () => {
  const rules = [
    { match: "torrentleech", tag: "torrentleech" },
    { match: "tracker.example.com", tag: "example" },
    { match: "tracker.example.com", tag: "private" },
  ];

  it("matches tracker URLs case-insensitively by substring", () => {
    const tags = findMatchingTags(
      [{ url: "https://Tracker.TorrentLeech.org/announce" }],
      rules
    );

    assert.deepEqual([...tags], ["torrentleech"]);
  });

  it("can apply multiple tags from one tracker", () => {
    const tags = findMatchingTags(
      [{ url: "https://tracker.example.com:443/announce" }],
      rules
    );

    assert.deepEqual([...tags].sort(), ["example", "private"]);
  });

  it("returns no tags when nothing matches", () => {
    const tags = findMatchingTags(
      [{ url: "** [DHT] **" }, { url: "udp://tracker.opentrackr.org:1337" }],
      rules
    );

    assert.deepEqual([...tags], []);
  });

  it("ignores trackers without a url", () => {
    const tags = findMatchingTags([{}, { url: null }], rules);
    assert.deepEqual([...tags], []);
  });
});

describe("parseExistingTags", () => {
  it("splits a comma-separated qBittorrent tag string", () => {
    assert.deepEqual(parseExistingTags("sonarr, torrentleech"), new Set([
      "sonarr",
      "torrentleech",
    ]));
  });

  it("returns an empty set for a missing tag string", () => {
    assert.deepEqual(parseExistingTags(""), new Set());
    assert.deepEqual(parseExistingTags(undefined), new Set());
  });
});

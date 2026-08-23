import { findMatchingTags, parseExistingTags, tagsToAdd } from "./rules.js";

export async function processTorrents({
  client,
  rules,
  log = console,
}) {
  const torrents = await client.getTorrents();

  for (const torrent of torrents) {
    try {
      const existingTags = parseExistingTags(torrent.tags);
      const trackers = await client.getTrackers(torrent.hash);
      const matchingTags = findMatchingTags(trackers, rules);
      const newTags = tagsToAdd(existingTags, matchingTags);

      if (newTags.length === 0) {
        continue;
      }

      await client.addTags(torrent.hash, newTags);
      log.info?.(`Tagged "${torrent.name}"`, { tags: newTags.join(",") });
    } catch (error) {
      log.error?.(`Failed processing "${torrent.name}"`, { error });
    }
  }
}

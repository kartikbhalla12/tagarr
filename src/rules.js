export function parseRules(raw) {
  if (raw == null || String(raw).trim() === "") {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TRACKER_TAG_RULES must be valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("TRACKER_TAG_RULES must be a JSON array");
  }

  return parsed.flatMap((rule) => {
    if (!rule || typeof rule !== "object") {
      return [];
    }

    const match = String(rule.match ?? "")
      .trim()
      .toLowerCase();
    const tag = String(rule.tag ?? "").trim();

    if (!match || !tag) {
      return [];
    }

    return [{ match, tag }];
  });
}

export function findMatchingTags(trackers, rules) {
  const tags = new Set();

  for (const tracker of trackers) {
    const url = String(tracker?.url ?? "").toLowerCase();
    if (!url) {
      continue;
    }

    for (const rule of rules) {
      if (url.includes(rule.match)) {
        tags.add(rule.tag);
      }
    }
  }

  return tags;
}

export function parseExistingTags(tags) {
  return new Set(
    String(tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

export function tagsToAdd(existingTags, matchingTags) {
  return [...matchingTags].filter((tag) => !existingTags.has(tag));
}

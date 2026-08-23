const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function formatError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [];
  const seen = new Set();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);

    if (!(current instanceof Error)) {
      parts.push(String(current));
      break;
    }

    const bits = [current.message];

    if (current.code && !current.message.includes(current.code)) {
      bits.push(current.code);
    }

    const host =
      current.address && current.port != null
        ? `${current.address}:${current.port}`
        : current.address;

    if (host && !current.message.includes(String(host))) {
      bits.push(host);
    }

    parts.push(bits.join(" "));
    current = current.cause;
  }

  return parts.join(" -> ");
}

export function createLogger({
  level = process.env.LOG_LEVEL ?? "info",
  now = () => new Date(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const minLevel = LEVELS[String(level).toLowerCase()] ?? LEVELS.info;

  function write(name, stream, message, fields) {
    if ((LEVELS[name] ?? LEVELS.info) < minLevel) {
      return;
    }

    const extras = formatFields(fields);
    const line = `${now().toISOString()} ${name.toUpperCase().padEnd(5)} ${message}${
      extras ? ` ${extras}` : ""
    }\n`;

    stream.write(line);
  }

  return {
    debug(message, fields) {
      write("debug", stdout, message, fields);
    },
    info(message, fields) {
      write("info", stdout, message, fields);
    },
    warn(message, fields) {
      write("warn", stdout, message, fields);
    },
    error(message, fields) {
      write("error", stderr, message, fields);
    },
  };
}

function formatFields(fields) {
  if (!fields) {
    return "";
  }

  return Object.entries(fields)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${key}=${quote(formatValue(key, value))}`)
    .join(" ");
}

function formatValue(key, value) {
  if (key === "error" || value instanceof Error) {
    return formatError(value);
  }

  return String(value);
}

function quote(value) {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

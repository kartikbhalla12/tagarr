export class QbitClient {
  constructor({ url, username, password, fetchImpl = fetch }) {
    this.baseUrl = String(url).replace(/\/$/, "");
    this.username = username ?? "";
    this.password = password ?? "";
    this.fetchImpl = fetchImpl;
    this.cookie = "";
  }

  async login() {
    if (!this.username && !this.password) {
      return;
    }

    const response = await this.requestRaw(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${this.baseUrl}/`,
        Origin: this.baseUrl,
      },
      body: new URLSearchParams({
        username: this.username,
        password: this.password,
      }),
    });

    const text = (await response.text()).trim();
    const cookies = response.headers.getSetCookie?.() ?? [];
    this.cookie = cookies.map((cookie) => cookie.split(";")[0]).join("; ");

    if (!isLoginSuccess(response, text, this.cookie)) {
      throw new Error(formatLoginFailure(response, text));
    }
  }

  async getTorrents() {
    const response = await this.request("/torrents/info");
    return response.json();
  }

  async getTrackers(hash) {
    const response = await this.request(
      `/torrents/trackers?${new URLSearchParams({ hash })}`
    );
    return response.json();
  }

  async addTags(hash, tags) {
    await this.request("/torrents/addTags", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        hashes: hash,
        tags: tags.join(","),
      }),
    });
  }

  async request(path, options = {}, retried = false) {
    const response = await this.requestRaw(`${this.baseUrl}/api/v2${path}`, {
      ...options,
      headers: {
        Referer: `${this.baseUrl}/`,
        Origin: this.baseUrl,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...options.headers,
      },
    });

    if (response.status === 403 && !retried) {
      await this.login();
      return this.request(path, options, true);
    }

    if (!response.ok) {
      throw new Error(`qBittorrent API ${path} failed: ${response.status}`);
    }

    return response;
  }

  async requestRaw(url, options) {
    try {
      return await this.fetchImpl(url, options);
    } catch (error) {
      throw new Error(`qBittorrent request failed (${url})`, { cause: error });
    }
  }
}

function isLoginSuccess(response, text, cookie) {
  if (text === "Ok.") {
    return true;
  }

  if (response.status === 204) {
    return true;
  }

  return response.ok && /(?:^|;\s*)SID=/i.test(cookie);
}

function formatLoginFailure(response, text) {
  const body = text.replace(/\s+/g, " ").slice(0, 180) || "<empty>";
  const location = response.headers.get("location");
  const redirect = location ? ` location=${location}` : "";
  return `qBittorrent login failed (${response.status}): ${body}${redirect}`;
}

const TOPICS_GITHUB = [
  "creative-coding", "generative-art", "pixel-art",
  "ambient-music", "shoegaze", "post-rock",
  "bjd", "3d-printing", "blender",
  "indie-game", "virtual-pet",
  "is-枝-裕和", "film-photography",
  "esp32", "robot"
];

const TOPICS_HN_KEYWORDS = [
  "art", "design", "film", "animation", "music", "creative",
  "robot", "esp32", "generative", "pixel", "indie",
  "photography", "craft", "doll", "print"
];

async function discoverGitHub() {
  const topic = TOPICS_GITHUB[Math.floor(Math.random() * TOPICS_GITHUB.length)];
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const query = encodeURIComponent(`topic:${topic} created:>=${since} stars:>5`);
  const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=8`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/vnd.github+json", "user-agent": "miao-surf/0.1" },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(item => ({
      title: item.full_name,
      url: item.html_url,
      summary: `${item.description ?? "没有描述"} · ${item.stargazers_count} stars${item.language ? ` · ${item.language}` : ""}`,
      source: "GitHub",
      topic
    }));
  } catch { return []; }
}

async function discoverHackerNews() {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const ids = (await res.json()).slice(0, 30);
    const items = await Promise.all(ids.map(async id => {
      try {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(10000) });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    }));
    return items
      .filter(item => item?.title && item.url)
      .filter(item => {
        const text = (item.title + " " + (item.text ?? "")).toLowerCase();
        return TOPICS_HN_KEYWORDS.some(kw => text.includes(kw));
      })
      .map(item => ({
        title: item.title,
        url: item.url,
        summary: `${item.score} points · ${item.descendants ?? 0} comments`,
        source: "Hacker News"
      }))
      .slice(0, 6);
  } catch { return []; }
}

const STATE_PATH = new URL(".surf-state.json", import.meta.url).pathname;

async function loadState() {
  try {
    const fs = await import("node:fs/promises");
    return JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
  } catch {
    return { recentUrls: [], lastRun: null };
  }
}

async function saveState(state) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

async function main() {
  const state = await loadState();
  const seenSet = new Set(state.recentUrls ?? []);

  console.log("正在逛网...\n");

  const [gh, hn] = await Promise.all([discoverGitHub(), discoverHackerNews()]);
  const all = [...gh, ...hn];
  const unseen = all.filter(c => !seenSet.has(c.url));
  const candidates = (unseen.length ? unseen : all).slice(0, 12);

  if (!candidates.length) {
    console.log("今天没找到有意思的东西。");
    return;
  }

  console.log(`找到 ${candidates.length} 个候选：\n`);
  candidates.forEach((c, i) => {
    console.log(`[${i}] [${c.source}${c.topic ? `/${c.topic}` : ""}] ${c.title}`);
    console.log(`    ${c.summary}`);
    console.log(`    ${c.url}\n`);
  });

  state.recentUrls = [...(state.recentUrls ?? []), ...candidates.map(c => c.url)].slice(-100);
  state.lastRun = new Date().toISOString();
  await saveState(state);

  console.log("---\n候选列表已输出，从里面挑一个带回去给老婆。");
}

main().catch(console.error);

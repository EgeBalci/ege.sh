/**
 * Projects page – fetches GitHub repos, computes stats,
 * renders highlighted projects and sliding carousels.
 */

// ========== Types ==========

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  language: string | null;
  forks_count: number;
  archived: boolean;
}

// ========== Constants ==========

const LANG_COLORS: Record<string, string> = {
  Go: "#00ADD8",
  Python: "#3572A5",
  JavaScript: "#F1E05A",
  TypeScript: "#3178C6",
  C: "#555555",
  "C++": "#F34B7D",
  "C#": "#178600",
  Rust: "#DEA584",
  Shell: "#89E051",
  Assembly: "#6E4C13",
  Ruby: "#CC342D",
  Java: "#B07219",
  HTML: "#E34C26",
  CSS: "#563D7C",
  Dockerfile: "#384D54",
  Makefile: "#427819",
  NSIS: "#A1E4D5",
  "Vim Script": "#199F4B",
  PowerShell: "#012456",
  Lua: "#000080",
  PHP: "#4F5D95",
  Perl: "#0298C3",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Zig: "#EC915C",
  Nim: "#ffc200",
};

const DEFAULT_LANG_COLOR = "#8B8B8B";

const IGNORED_LANGUAGES = new Set([
  "Dockerfile",
  "Makefile",
  "HTML",
  "CSS",
  "NSIS",
  "Vim Script",
  "Ruby",
  "JavaScript",
]);

const API_URL = "https://api.github.com/users";
const USERNAME = "EgeBalci";
const HIGHLIGHTED_COUNT = 6;

// ========== GitHub API ==========

async function fetchAllRepos(): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const url = `${API_URL}/${USERNAME}/repos?per_page=100&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const repos: GitHubRepo[] = await res.json();
    if (repos.length === 0) break;

    allRepos.push(...repos);

    const link = res.headers.get("Link");
    if (!link || !link.includes('rel="next"')) break;
    page++;
  }

  return allRepos.filter((r) => !r.fork);
}

// ========== Stats ==========

interface Stats {
  totalProjects: number;
  totalStars: number;
  langCounts: Record<string, number>;
}

function computeStats(repos: GitHubRepo[]): Stats {
  const totalProjects = repos.length;
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  const langCounts: Record<string, number> = {};
  for (const repo of repos) {
    const lang = repo.language || "Other";
    if (IGNORED_LANGUAGES.has(lang)) continue;
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  }

  return { totalProjects, totalStars, langCounts };
}

// ========== Doughnut Chart ==========

function drawDoughnut(
  canvas: HTMLCanvasElement,
  langCounts: Record<string, number>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const outerR = Math.min(cx, cy) - 4;
  const innerR = outerR * 0.55;

  const total = Object.values(langCounts).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(langCounts).sort(([, a], [, b]) => b - a);

  let angle = -Math.PI / 2;

  for (const [lang, count] of sorted) {
    const slice = (count / total) * Math.PI * 2;
    const color = LANG_COLORS[lang] || DEFAULT_LANG_COLOR;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.arc(cx, cy, innerR, angle + slice, angle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Draw gap between slices
    ctx.strokeStyle = "#121211";
    ctx.lineWidth = 2;
    ctx.stroke();

    angle += slice;
  }
}

// ========== DOM Helpers ==========

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classes?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text !== undefined) e.textContent = text;
  return e;
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ========== Render Functions ==========

function renderStats(container: HTMLElement, stats: Stats): void {
  container.innerHTML = "";

  const wrapper = h(
    "div",
    "flex flex-col md:flex-row gap-4 items-stretch",
  );

  // — Stat cards —
  const projectCard = h(
    "div",
    "flex flex-col items-center justify-center min-w-[9rem] bg-[#1a1a19] border border-[#2a2a29] rounded-lg p-5 opacity-0",
  );
  projectCard.innerHTML = `
    <span class="text-3xl font-bold text-[#f9f9f7]">${stats.totalProjects}</span>
    <span class="text-[10px] text-[#888] mt-1.5 uppercase tracking-widest">Projects</span>
  `;

  const starCard = h(
    "div",
    "flex flex-col items-center justify-center min-w-[9rem] bg-[#1a1a19] border border-[#2a2a29] rounded-lg p-5 opacity-0",
  );
  starCard.innerHTML = `
    <span class="text-3xl font-bold text-[#f9f9f7]"><i class="fa-solid fa-star text-2xl"></i> ${formatStars(stats.totalStars)}</span>
    <span class="text-[10px] text-[#888] mt-1.5 uppercase tracking-widest">Total Stars</span>
  `;

  // — Doughnut chart + legend box —
  const chartBox = h(
    "div",
    "flex items-center gap-5 flex-1 bg-[#1a1a19] border border-[#2a2a29] rounded-lg p-5 opacity-0",
  );

  const canvas = document.createElement("canvas");
  canvas.className = "flex-shrink-0";
  canvas.style.width = "7rem";
  canvas.style.height = "7rem";
  chartBox.appendChild(canvas);

  // Legend
  const legend = h("div", "flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]");
  const sorted = Object.entries(stats.langCounts).sort(([, a], [, b]) => b - a);
  const topLangs = sorted.slice(0, 8);

  for (const [lang, count] of topLangs) {
    const item = h("div", "flex items-center gap-1.5");
    const dot = h("span", "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0");
    dot.style.backgroundColor = LANG_COLORS[lang] || DEFAULT_LANG_COLOR;
    const label = h("span", "text-[#999]", `${lang} (${count})`);
    item.append(dot, label);
    legend.appendChild(item);
  }

  if (sorted.length > 8) {
    const rest = sorted.slice(8).reduce((s, [, c]) => s + c, 0);
    const item = h("div", "flex items-center gap-1.5");
    const dot = h("span", "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0");
    dot.style.backgroundColor = DEFAULT_LANG_COLOR;
    const label = h("span", "text-[#999]", `Other (${rest})`);
    item.append(dot, label);
    legend.appendChild(item);
  }

  chartBox.appendChild(legend);

  wrapper.append(projectCard, starCard, chartBox);
  container.appendChild(wrapper);

  // Draw chart after layout
  requestAnimationFrame(() => {
    drawDoughnut(canvas, stats.langCounts);
  });
}

function createProjectBox(
  repo: GitHubRepo,
  size: "medium" | "small",
): HTMLAnchorElement {
  if (size === "medium") {
    const box = h(
      "a",
      "block bg-[#1a1a19] border border-[#2a2a29] rounded-lg p-5 " +
        "hover:border-[#444] hover:bg-[#1f1f1e] transition-all duration-300 " +
        "cursor-pointer group opacity-0",
    ) as HTMLAnchorElement;
    box.href = repo.html_url;
    box.target = "_blank";
    box.rel = "noopener noreferrer";
    box.role = "button";

    // Header row: name + stars
    const header = h("div", "flex items-center justify-between mb-2");
    const name = h(
      "h3",
      "text-sm font-bold text-[#e0e0de] group-hover:text-[#f9f9f7] truncate transition-colors",
      repo.name,
    );
    const stars = h(
      "span",
      "text-xs text-[#888] flex-shrink-0 ml-3",
    );
    stars.innerHTML = `<i class="fa-solid fa-star text-[10px]"></i> ${formatStars(repo.stargazers_count)}`;
    header.append(name, stars);

    // Description
    const desc = h(
      "p",
      "text-xs text-[#777] leading-relaxed mb-3 line-clamp-2",
      repo.description || "No description available.",
    );

    // Language tags
    const tags = h("div", "flex flex-wrap gap-1.5 mt-auto");
    if (repo.language) {
      const tag = h(
        "span",
        "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full " +
          "bg-[#252524] text-[#aaa] border border-[#333]",
      );
      const dot = h("span", "inline-block w-1.5 h-1.5 rounded-full");
      dot.style.backgroundColor =
        LANG_COLORS[repo.language] || DEFAULT_LANG_COLOR;
      tag.append(dot, document.createTextNode(repo.language));
      tags.appendChild(tag);
    }

    box.append(header, desc, tags);
    return box;
  }

  // — small box (carousel) —
  const box = h(
    "a",
    "inline-flex flex-col justify-center flex-shrink-0 w-52 h-[4.5rem] " +
      "bg-[#1a1a19] border border-[#2a2a29] rounded-lg px-3.5 py-2 " +
      "hover:border-[#444] transition-all duration-200 cursor-pointer",
  ) as HTMLAnchorElement;
  box.href = repo.html_url;
  box.target = "_blank";
  box.rel = "noopener noreferrer";
  box.role = "button";

  const name = h(
    "span",
    "text-xs font-bold text-[#e0e0de] truncate block",
    repo.name,
  );
  const meta = h("div", "flex items-center gap-2 mt-1");
  const stars = h(
    "span",
    "text-[10px] text-[#777]",
  );
  stars.innerHTML = `<i class="fa-solid fa-star"></i> ${repo.stargazers_count}`;
  meta.appendChild(stars);

  if (repo.language) {
    const langTag = h(
      "span",
      "inline-flex items-center gap-1 text-[10px] text-[#777]",
    );
    const dot = h("span", "inline-block w-1.5 h-1.5 rounded-full");
    dot.style.backgroundColor =
      LANG_COLORS[repo.language] || DEFAULT_LANG_COLOR;
    langTag.append(dot, document.createTextNode(repo.language));
    meta.appendChild(langTag);
  }

  box.append(name, meta);
  return box;
}

function renderHighlighted(
  container: HTMLElement,
  repos: GitHubRepo[],
): void {
  container.innerHTML = "";

  const top5 = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, HIGHLIGHTED_COUNT);

  const grid = h(
    "div",
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
  );

  for (const repo of top5) {
    grid.appendChild(createProjectBox(repo, "medium"));
  }

  container.appendChild(grid);
}

function renderCarousel(
  container: HTMLElement,
  repos: GitHubRepo[],
): void {
  container.innerHTML = "";

  // Sort by stars, use ALL repos across the carousel rows
  const sorted = [...repos].sort(
    (a, b) => b.stargazers_count - a.stargazers_count,
  );
  const remaining = sorted.slice(HIGHLIGHTED_COUNT);

  if (remaining.length === 0) return;

  // Distribute across 3 rows
  const rows: GitHubRepo[][] = [[], [], []];
  remaining.forEach((repo, i) => {
    rows[i % 3]!.push(repo);
  });

  const directions = ["scroll-left", "scroll-right", "scroll-left"];
  const speeds = [45, 38, 52]; // seconds

  rows.forEach((row, i) => {
    if (row.length === 0) return;

    const wrapper = h("div", "carousel-wrapper overflow-hidden mb-3 opacity-0");
    const track = h("div", "carousel-track flex gap-3");

    // Duplicate content for seamless loop
    for (let dup = 0; dup < 2; dup++) {
      for (const repo of row) {
        track.appendChild(createProjectBox(repo, "small"));
      }
    }

    track.style.setProperty("--duration", `${speeds[i]}s`);
    track.classList.add(directions[i]!);

    wrapper.appendChild(track);
    container.appendChild(wrapper);
  });
}

// ========== Content Visibility ==========

function revealSection(
  skeletonId: string,
  contentId: string,
  stagger = true,
): void {
  const skeleton = document.getElementById(skeletonId);
  const content = document.getElementById(contentId);

  if (skeleton) skeleton.classList.add("hidden");
  if (!content) return;

  content.classList.remove("hidden");

  // Trigger fade-in animations after the container is visible
  requestAnimationFrame(() => {
    const targets = content.querySelectorAll<HTMLElement>(".opacity-0");
    targets.forEach((el, i) => {
      if (stagger) {
        el.style.animationDelay = `${i * 0.1}s`;
      }
      el.classList.add("animate-fade-in");
    });
  });
}

// ========== Error UI ==========

function showError(message: string): void {
  const app = document.getElementById("app");
  if (!app) return;

  // Hide all skeletons
  document
    .querySelectorAll('[id$="-skeleton"]')
    .forEach((el) => el.classList.add("hidden"));

  const err = h(
    "div",
    "text-center text-[#888] py-16 text-sm",
    message,
  );
  const statsSection = document.getElementById("stats-section");
  if (statsSection) {
    statsSection.innerHTML = "";
    statsSection.appendChild(err);
  }
}

// ========== Init ==========

async function init(): Promise<void> {
  try {
    const repos = await fetchAllRepos();
    const stats = computeStats(repos);

    // Render stats
    const statsContent = document.getElementById("stats-content");
    if (statsContent) {
      renderStats(statsContent, stats);
      revealSection("stats-skeleton", "stats-content");
    }

    // Render highlighted projects
    const highlightedContent = document.getElementById("highlighted-content");
    if (highlightedContent) {
      renderHighlighted(highlightedContent, repos);
      revealSection("highlighted-skeleton", "highlighted-content");
    }

    // Render carousel
    const carouselContent = document.getElementById("carousel-content");
    if (carouselContent) {
      renderCarousel(carouselContent, repos);
      revealSection("carousel-skeleton", "carousel-content", false);
    }
  } catch (err) {
    console.error("Failed to load projects:", err);
    showError("Failed to load projects. Please try again later.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

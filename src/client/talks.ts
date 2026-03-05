/**
 * Talks page – loads talk data from JSON, renders filterable
 * talk cards with YouTube thumbnails and category tags.
 */

// ========== Types ==========

interface Talk {
  conference: string;
  title: string;
  link: string;
  date: string; // DD-MM-YYYY
  tags: string[];
}

// ========== Constants ==========

const TALKS_JSON_URL = "/data/talks.json";

const TAG_COLORS: Record<string, string> = {
  malware: "#E06C75",
  obfuscation: "#C678DD",
  evasion: "#D19A66",
  cti: "#61AFEF",
  cybercrime: "#E5C07B",
  "0day": "#F44747",
  exploit: "#BE5046",
  vulnerability: "#E06C75",
  ransomware: "#D19A66",
  english: "#56B6C2",
  turkish: "#98C379",
};

const DEFAULT_TAG_COLOR = "#8B8B8B";

// ========== YouTube Helpers ==========

/**
 * Extract a YouTube video ID from various YouTube URL formats.
 * Returns null if the URL is not a recognized YouTube link.
 */
function extractYouTubeId(url: string): string | null {
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1] ?? null;

  // youtube.com/watch?v=VIDEO_ID
  const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (longMatch) return longMatch[1] ?? null;

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1] ?? null;

  return null;
}

/**
 * Get YouTube thumbnail URL for a video ID.
 */
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

// ========== DOM Helpers ==========

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classes?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (classes) el.className = classes;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ========== Data Loading ==========

async function fetchTalks(): Promise<Talk[]> {
  const res = await fetch(TALKS_JSON_URL);
  if (!res.ok) throw new Error(`Failed to load talks: ${res.status}`);
  return res.json();
}

// ========== State ==========

let allTalks: Talk[] = [];
let activeFilter: string | null = null;

// ========== Render ==========

function createTalkCard(talk: Talk, index: number): HTMLAnchorElement {
  const card = h(
    "a",
    "talk-card block bg-[#1a1a19] border border-[#2a2a29] rounded-lg overflow-hidden " +
      "hover:border-[#444] hover:bg-[#1f1f1e] transition-all duration-300 " +
      "cursor-pointer group opacity-0 " +
      "w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.833rem)]",
  ) as HTMLAnchorElement;
  card.href = talk.link;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.style.animationDelay = `${index * 0.08}s`;

  // Thumbnail
  const videoId = extractYouTubeId(talk.link);
  if (videoId) {
    const thumbWrap = h(
      "div",
      "relative w-full aspect-video bg-[#1e1e1d] overflow-hidden",
    );
    const img = document.createElement("img");
    img.src = getYouTubeThumbnail(videoId);
    img.alt = talk.title;
    img.loading = "lazy";
    img.className =
      "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500";
    // Fallback on image error (use medium quality thumb)
    img.onerror = () => {
      img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      img.onerror = null;
    };

    // Play icon overlay
    const playOverlay = h(
      "div",
      "absolute inset-0 flex items-center justify-center " +
        "bg-black/20 group-hover:bg-black/40 transition-colors duration-300",
    );
    const playIcon = h(
      "div",
      "w-10 h-10 rounded-full bg-black/60 flex items-center justify-center " +
        "group-hover:bg-red-600/90 transition-colors duration-300",
    );
    playIcon.innerHTML = '<i class="fa-solid fa-play text-white text-xs ml-0.5"></i>';
    playOverlay.appendChild(playIcon);

    thumbWrap.append(img, playOverlay);
    card.appendChild(thumbWrap);
  } else {
    // Non-YouTube: placeholder with conference icon
    const placeholder = h(
      "div",
      "w-full aspect-video bg-[#1e1e1d] flex items-center justify-center",
    );
    placeholder.innerHTML =
      '<i class="fa-solid fa-microphone-lines text-3xl text-[#333]"></i>';
    card.appendChild(placeholder);
  }

  // Content
  const content = h("div", "p-4");

  // Conference + date row
  const meta = h("div", "flex items-center justify-between mb-1.5");
  const conf = h(
    "span",
    "text-[10px] text-[#888] uppercase tracking-wider truncate",
    talk.conference,
  );
  const date = h("span", "text-[10px] text-[#666] flex-shrink-0 ml-2", talk.date);
  meta.append(conf, date);

  // Title
  const title = h(
    "h3",
    "text-sm font-bold text-[#e0e0de] group-hover:text-[#f9f9f7] " +
      "transition-colors leading-snug mb-2.5 line-clamp-2",
    talk.title,
  );

  // Tags
  const tagsWrap = h("div", "flex flex-wrap gap-1.5");
  for (const tag of talk.tags) {
    const tagEl = h(
      "span",
      "inline-flex items-center text-[9px] px-2 py-0.5 rounded-full " +
        "border border-[#333] bg-[#252524]",
      tag,
    );
    const color = TAG_COLORS[tag] || DEFAULT_TAG_COLOR;
    tagEl.style.color = color;
    tagEl.style.borderColor = color + "33"; // subtle border tint
    tagsWrap.appendChild(tagEl);
  }

  content.append(meta, title, tagsWrap);
  card.appendChild(content);

  return card;
}

function renderFilterBar(container: HTMLElement, talks: Talk[]): void {
  container.innerHTML = "";

  // Collect all unique tags
  const tagSet = new Set<string>();
  for (const talk of talks) {
    for (const tag of talk.tags) {
      tagSet.add(tag);
    }
  }
  const allTags = [...tagSet].sort();

  const wrapper = h("div", "flex flex-wrap gap-2 items-center");

  // "All" button
  const allBtn = h(
    "button",
    "filter-btn text-[11px] px-3 py-1 rounded-full border transition-all duration-200 " +
      "opacity-0",
    "all",
  );
  applyFilterStyle(allBtn, activeFilter === null);
  allBtn.addEventListener("click", () => {
    activeFilter = null;
    updateFilterStyles();
    renderTalks();
  });
  wrapper.appendChild(allBtn);

  for (const tag of allTags) {
    const btn = h(
      "button",
      "filter-btn text-[11px] px-3 py-1 rounded-full border transition-all duration-200 " +
        "opacity-0",
      tag,
    );
    const color = TAG_COLORS[tag] || DEFAULT_TAG_COLOR;
    btn.dataset.tag = tag;
    btn.dataset.color = color;
    applyFilterStyle(btn, activeFilter === tag);
    btn.addEventListener("click", () => {
      activeFilter = activeFilter === tag ? null : tag;
      updateFilterStyles();
      renderTalks();
    });
    wrapper.appendChild(btn);
  }

  container.appendChild(wrapper);
}

function applyFilterStyle(btn: HTMLElement, isActive: boolean): void {
  const color = btn.dataset.color || "#f9f9f7";
  if (isActive) {
    btn.style.backgroundColor = color + "22";
    btn.style.borderColor = color;
    btn.style.color = "#f9f9f7";
  } else {
    btn.style.backgroundColor = "transparent";
    btn.style.borderColor = "#2a2a29";
    btn.style.color = "#888";
  }
}

function updateFilterStyles(): void {
  const buttons = document.querySelectorAll<HTMLElement>(".filter-btn");
  buttons.forEach((btn) => {
    const tag = btn.dataset.tag;
    const isActive = tag === undefined ? activeFilter === null : activeFilter === tag;
    applyFilterStyle(btn, isActive);
  });
}

function renderTalks(): void {
  const container = document.getElementById("talks-content");
  if (!container) return;

  const filtered =
    activeFilter === null
      ? allTalks
      : allTalks.filter((t) => t.tags.includes(activeFilter!));

  container.innerHTML = "";

  const wrapper = h("div", "flex flex-wrap gap-5");

  if (filtered.length === 0) {
    const empty = h(
      "div",
      "text-center text-[#666] py-12 text-sm w-full",
      "No talks found for this category.",
    );
    wrapper.appendChild(empty);
  } else {
    filtered.forEach((talk, i) => {
      wrapper.appendChild(createTalkCard(talk, i));
    });
  }

  container.appendChild(wrapper);

  // Trigger fade-in
  requestAnimationFrame(() => {
    const cards = container.querySelectorAll<HTMLElement>(".opacity-0");
    cards.forEach((el) => {
      el.classList.add("animate-fade-in-up");
    });
  });
}

// ========== Reveal helpers ==========

function revealSection(
  skeletonId: string,
  contentId: string,
): void {
  const skeleton = document.getElementById(skeletonId);
  const content = document.getElementById(contentId);

  if (skeleton) skeleton.classList.add("hidden");
  if (!content) return;
  content.classList.remove("hidden");

  requestAnimationFrame(() => {
    const targets = content.querySelectorAll<HTMLElement>(".opacity-0");
    targets.forEach((el, i) => {
      el.style.animationDelay = `${i * 0.05}s`;
      el.classList.add("animate-fade-in");
    });
  });
}

// ========== Error ==========

function showError(message: string): void {
  document
    .querySelectorAll('[id$="-skeleton"]')
    .forEach((el) => el.classList.add("hidden"));

  const section = document.getElementById("talks-section");
  if (section) {
    section.innerHTML = `<div class="text-center text-[#888] py-16 text-sm">${message}</div>`;
  }
}

// ========== Init ==========

async function init(): Promise<void> {
  try {
    allTalks = await fetchTalks();

    // Render filter bar
    const filterContent = document.getElementById("filter-content");
    if (filterContent) {
      renderFilterBar(filterContent, allTalks);
      revealSection("filter-skeleton", "filter-content");
    }

    // Render talks
    const talksContent = document.getElementById("talks-content");
    if (talksContent) {
      const skeleton = document.getElementById("talks-skeleton");
      if (skeleton) skeleton.classList.add("hidden");
      talksContent.classList.remove("hidden");
      renderTalks();
    }
  } catch (err) {
    console.error("Failed to load talks:", err);
    showError("Failed to load talks. Please try again later.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

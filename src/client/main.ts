/**
 * Main client entry point.
 * Checks WebGL support, loads the appropriate animation,
 * initializes the ASCII ripple effect on article links,
 * and dynamically fits content to the visitor's viewport.
 */

import { isWebGLSupported, initGLFrame } from "./webgl-magic";
import { initASCIIShift, createASCIIShift } from "./ascii-effect";

/**
 * Dynamically adjust layout to fit within the visitor's viewport.
 * Scales spacing, canvas size, and hides decorative elements as needed.
 */
const fitToViewport = (): void => {
  const vh = window.innerHeight;
  const main = document.getElementById("main");
  if (!main) return;

  const ct = main.querySelector<HTMLElement>(".ct");
  if (!ct) return;

  // Set CSS custom property for real viewport height (mobile address bar safe)
  document.documentElement.style.setProperty("--vh", `${vh * 0.01}px`);

  // Get all br elements and toggle visibility based on available space
  const brs = ct.querySelectorAll<HTMLElement>("br");
  const canvas = ct.querySelector<HTMLElement>("#gl, .bat-container");
  const socialLinks = ct.querySelector<HTMLElement>(".about-social-links");

  // Tight viewport: collapse decorative spacing
  if (vh < 700) {
    brs.forEach((br) => (br.style.display = "none"));
    if (canvas) {
      canvas.style.maxWidth = `${Math.max(10, Math.min(20, vh * 0.025))}rem`;
    }
    if (socialLinks) {
      socialLinks.style.margin = "0.4em 0";
      socialLinks.style.gap = "0.3rem";
    }
  } else {
    brs.forEach((br) => (br.style.display = ""));
    if (canvas) canvas.style.maxWidth = "";
    if (socialLinks) {
      socialLinks.style.margin = "";
      socialLinks.style.gap = "";
    }
  }

  // Very tight: hide canvas entirely
  if (vh < 480) {
    if (canvas) canvas.style.display = "none";
  } else {
    if (canvas) canvas.style.display = "";
  }
};

/**
 * Load the bat.css fallback stylesheet and create the bat animation element.
 * Called when WebGL is not supported by the browser.
 */
const loadBatFallback = (): void => {
  // Remove the WebGL canvas
  const canvas = document.getElementById("gl");
  if (canvas) {
    // Create the bat container + bat element
    const batContainer = document.createElement("div");
    batContainer.className = "bat-container";

    const batElement = document.createElement("div");
    batElement.className = "bat";
    batContainer.appendChild(batElement);

    // Replace canvas with bat animation
    canvas.parentNode?.replaceChild(batContainer, canvas);
  }

  // Dynamically load bat.css
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/bat.css";
  document.head.appendChild(link);
};

/**
 * Check if the viewport is too small to benefit from WebGL.
 * Returns true for mobile-sized screens or compact windows.
 */
const isSmallViewport = (): boolean => {
  return window.innerWidth < 768 || window.innerHeight < 480;
};

// ========== RSS Article Loading ==========

const RSS_URL = "https://blog.ege.sh/posts/index.xml";

const FALLBACK_XML_URL = "/data/fallback-posts.xml";

interface ArticleItem {
  title: string;
  link: string;
  date: string; // DD-MM-YYYY
}

/**
 * Format a Date to DD-MM-YYYY string.
 */
const formatDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * Parse RSS XML string into ArticleItem[].
 */
const parseRSS = (xmlStr: string): ArticleItem[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  const items = doc.querySelectorAll("item");
  const articles: ArticleItem[] = [];

  items.forEach((item) => {
    const title = item.querySelector("title")?.textContent ?? "Untitled";
    const link = item.querySelector("link")?.textContent ?? "#";
    const pubDate = item.querySelector("pubDate")?.textContent;
    const date = pubDate ? formatDate(new Date(pubDate)) : "??-??-????";
    articles.push({ title, link, date });
  });

  return articles;
};

/**
 * Fetch the RSS feed and return parsed articles.
 * Falls back to the embedded XML on any failure.
 */
const fetchArticles = async (): Promise<ArticleItem[]> => {
  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const articles = parseRSS(xml);
    if (articles.length === 0) throw new Error("Empty feed");
    return articles;
  } catch (err) {
    console.warn("RSS fetch failed, using fallback:", err);
    try {
      const fallbackRes = await fetch(FALLBACK_XML_URL);
      if (!fallbackRes.ok) throw new Error(`Fallback HTTP ${fallbackRes.status}`);
      const fallbackXml = await fallbackRes.text();
      return parseRSS(fallbackXml);
    } catch (fallbackErr) {
      console.error("Fallback XML also failed:", fallbackErr);
      return [];
    }
  }
};

/**
 * Render articles into the #articles list, trigger fade-in and ASCII ripple.
 */
const loadArticles = async (): Promise<void> => {
  const list = document.getElementById("articles");
  if (!list) return;

  const articles = await fetchArticles();

  // Clear skeleton items
  list.innerHTML = "";

  articles.forEach((article, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = article.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `${article.date} - ${article.title}`;

    // Start invisible for fade-in
    li.classList.add("article-fade-in");
    li.style.animationDelay = `${i * 0.1}s`;

    li.appendChild(a);
    list.appendChild(li);

    // After fade-in starts, attach ASCII shift and fire an initial ripple from position 0
    setTimeout(() => {
      const instance = createASCIIShift(a, { dur: 1000, spread: 1 });
      instance.triggerWave(0);
    }, i * 100 + 50);
  });
};

/**
 * Initialize the page
 */
const init = (): void => {
  // Check WebGL support and load appropriate animation
  if (!isSmallViewport() && isWebGLSupported()) {
    try {
      initGLFrame();
    } catch (error) {
      console.warn("WebGL initialization failed, falling back to bat animation:", error);
      loadBatFallback();
    }
  } else {
    console.info("WebGL not supported, loading bat animation fallback");
    loadBatFallback();
  }

  // Load articles from RSS then init ASCII shift on them
  loadArticles();

  // Initialize ASCII shift ripple effect on any non-article links
  initASCIIShift();

  // Fit content to viewport on load and resize
  fitToViewport();
  window.addEventListener("resize", fitToViewport);
};

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

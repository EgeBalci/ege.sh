/**
 * ASCII ripple/shift animation for link elements.
 * Hover triggers a wave of scrambled characters that ripples outward.
 */

// Constants for wave animation behavior
const WAVE_THRESH = 3;
const CHAR_MULT = 3;
const ANIM_STEP = 40;
const WAVE_BUF = 5;

interface ASCIIShiftOptions {
  dur?: number;
  chars?: string;
  preserveSpaces?: boolean;
  spread?: number;
}

interface Wave {
  startPos: number;
  startTime: number;
  id: number;
}

interface ASCIIShiftInstance {
  updateTxt: (newTxt: string) => void;
  resetToOrig: () => void;
  triggerWave: (pos?: number) => void;
  destroy: () => void;
}

/**
 * ASCII ripple animation instance for an element
 */
export const createASCIIShift = (
  el: HTMLElement,
  opts: ASCIIShiftOptions = {}
): ASCIIShiftInstance => {
  // State variables
  let origTxt = el.textContent || "";
  let origChars = origTxt.split("");
  let isAnim = false;
  let cursorPos = 0;
  let waves: Wave[] = [];
  let animId: number | null = null;
  let isHover = false;
  let origW: number | null = null;

  // options
  const cfg = {
    dur: 600,
    chars: '.,·-─~+:;=*π""┐┌┘┴┬╗╔╝╚╬╠╣╩╦║░▒▓█▄▀▌▐■!?&#$@0123456789*',
    preserveSpaces: true,
    spread: 0.3,
    ...opts,
  };

  /**
   * Updates cursor position based on mouse move
   */
  const updateCursorPos = (e: MouseEvent): void => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const len = origTxt.length;
    const pos = Math.round((x / rect.width) * len);
    cursorPos = Math.max(0, Math.min(pos, len - 1));
  };

  /**
   * Starts a new wave animation from current cursor pos
   */
  const startWave = (): void => {
    waves.push({
      startPos: cursorPos,
      startTime: Date.now(),
      id: Math.random(),
    });

    if (!isAnim) start();
  };

  /**
   * Clean up expired waves that have exceeded their duration
   */
  const cleanupWaves = (t: number): void => {
    waves = waves.filter((w) => t - w.startTime < cfg.dur);
  };

  /**
   * Calculates wave fx for a character at given index
   */
  const calcWaveEffect = (
    charIdx: number,
    t: number
  ): { shouldAnim: boolean; char: string } => {
    let shouldAnim = false;
    let resultChar = origChars[charIdx];

    for (const w of waves) {
      const age = t - w.startTime;
      const prog = Math.min(age / cfg.dur, 1);
      const dist = Math.abs(charIdx - w.startPos);
      const maxDist = Math.max(
        w.startPos,
        origChars.length - w.startPos - 1
      );
      const rad = (prog * (maxDist + WAVE_BUF)) / cfg.spread;

      if (dist <= rad) {
        shouldAnim = true;
        const intens = Math.max(0, rad - dist);

        if (intens <= WAVE_THRESH && intens > 0) {
          const cIdx =
            (dist * CHAR_MULT + Math.floor(age / ANIM_STEP)) %
            cfg.chars.length;
          resultChar = cfg.chars[cIdx];
        }
      }
    }

    return { shouldAnim, char: resultChar };
  };

  /**
   * Generates scrambled text based on current waves
   */
  const genScrambledTxt = (t: number): string =>
    origChars
      .map((char, i) => {
        if (cfg.preserveSpaces && char === " ") return " ";
        const res = calcWaveEffect(i, t);
        return res.shouldAnim ? res.char : char;
      })
      .join("");

  /**
   * Stops the animation and resets to original text
   */
  const stop = (): void => {
    el.textContent = origTxt;
    el.classList.remove("as");

    if (origW !== null) {
      el.style.width = "";
      origW = null;
    }
    isAnim = false;
  };

  /**
   * Start the animation loop
   */
  const start = (): void => {
    if (isAnim) return;

    if (origW === null) {
      origW = el.getBoundingClientRect().width;
      el.style.width = `${origW}px`;
    }

    isAnim = true;
    el.classList.add("as");

    const animate = (): void => {
      const t = Date.now();

      cleanupWaves(t);

      if (waves.length === 0) {
        stop();
        return;
      }

      el.textContent = genScrambledTxt(t);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
  };

  /**
   * Event handlers
   */
  const handleEnter = (e: MouseEvent): void => {
    isHover = true;
    updateCursorPos(e);
    startWave();
  };

  const handleMove = (e: MouseEvent): void => {
    if (!isHover) return;
    const old = cursorPos;
    updateCursorPos(e);
    if (cursorPos !== old) startWave();
  };

  const handleLeave = (): void => {
    isHover = false;
  };

  /**
   * Initializes event listeners
   */
  const init = (): void => {
    el.addEventListener("mouseenter", handleEnter as EventListener);
    el.addEventListener("mousemove", handleMove as EventListener);
    el.addEventListener("mouseleave", handleLeave);
  };

  /**
   * Resets animation to original state
   */
  const resetToOrig = (): void => {
    waves = [];
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    if (origW !== null) {
      el.style.width = "";
      origW = null;
    }
    stop();
  };

  /**
   * Updates the text content
   */
  const updateTxt = (newTxt: string): void => {
    origTxt = newTxt;
    origChars = newTxt.split("");
    if (!isAnim) el.textContent = newTxt;
  };

  /**
   * Destroys the instance and cleans up event listeners
   */
  const destroy = (): void => {
    resetToOrig();
    el.removeEventListener("mouseenter", handleEnter as EventListener);
    el.removeEventListener("mousemove", handleMove as EventListener);
    el.removeEventListener("mouseleave", handleLeave);
  };

  // Initialize the instance
  init();

  /**
   * Programmatically triggers a wave from a given character position.
   */
  const triggerWave = (pos = 0): void => {
    cursorPos = Math.max(0, Math.min(pos, origChars.length - 1));
    startWave();
  };

  // public API
  return { updateTxt, resetToOrig, triggerWave, destroy };
};

/**
 * Initialize ASCII shift animation for article links only
 */
export const initASCIIShift = (): void => {
  const links = document.querySelectorAll<HTMLAnchorElement>(".pt a");
  links.forEach((link) => {
    if (!link.textContent?.trim()) return;
    createASCIIShift(link, { dur: 1000, spread: 1 });
  });
};

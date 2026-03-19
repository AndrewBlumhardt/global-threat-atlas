// Speed levels in pixels/second (zoom-independent).
// Converted to longitude degrees at runtime using the current zoom so the visual
// speed feels consistent regardless of how far in/out the user has zoomed.
// Sub-pixel deltas are accumulated across frames so every level produces a
// perceptibly different speed even at low zoom where 1° ≈ 2-3 px.
const AUTO_SCROLL_SPEED_LEVELS = {
  1: 20,
  2: 40,
  3: 65,
  4: 95,
  5: 130,
};
const DEFAULT_SPEED_LEVEL = 2;
const AUTO_SCROLL_DIRECTION = "right"; // "left" or "right"
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;

export function addAutoScrollControl(map) {
  let scrolling = false;
  let rafId = null;
  let lastRafTimestamp = null;
  let speedLevel = DEFAULT_SPEED_LEVEL;
  let menuHideTimerId = null;
  let pendingLongitude = 0; // accumulated sub-pixel longitude degrees not yet sent to the map

  const control = document.createElement("div");
  control.id = "autoScrollControl";
  control.className = "azure-maps-control-container";
  control.style.position = "fixed";
  control.style.bottom = "145px";
  control.style.right = "10px";
  control.style.zIndex = "1000";
  control.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.className = "azure-maps-control-button";
  button.title = "Toggle Auto Scroll";
  button.textContent = "→";
  button.style.fontSize = "20px";
  button.style.width = "32px";
  button.style.height = "32px";
  button.style.padding = "0";
  button.style.border = "2px solid rgba(255, 255, 255, 0.5)";
  button.style.borderRadius = "4px";
  button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  button.style.color = "#333";
  button.style.cursor = "pointer";
  button.style.transition = "all 0.2s";

  // Hidden popup menu appears only when auto-scroll is toggled.
  const speedMenu = document.createElement("div");
  speedMenu.style.position = "absolute";
  speedMenu.style.bottom = "40px";
  speedMenu.style.right = "0";
  speedMenu.style.display = "none";
  speedMenu.style.padding = "5px";
  speedMenu.style.background = "rgba(255, 255, 255, 0.92)";
  speedMenu.style.border = "1px solid rgba(0, 0, 0, 0.12)";
  speedMenu.style.borderRadius = "6px";
  speedMenu.style.boxShadow = "0 3px 8px rgba(0, 0, 0, 0.18)";
  speedMenu.style.zIndex = "1001";

  const speedMenuRow = document.createElement("div");
  speedMenuRow.style.display = "flex";
  speedMenuRow.style.gap = "4px";
  speedMenu.appendChild(speedMenuRow);

  function clearMenuAutoHide() {
    if (menuHideTimerId) {
      clearTimeout(menuHideTimerId);
      menuHideTimerId = null;
    }
  }

  function scheduleMenuAutoHide() {
    clearMenuAutoHide();
    menuHideTimerId = setTimeout(() => {
      speedMenu.style.display = "none";
    }, 2500);
  }

  function createSpeedOption(level) {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.textContent = String(level);
    optionButton.title = `Set auto scroll speed to ${level}`;
    optionButton.style.width = "22px";
    optionButton.style.height = "22px";
    optionButton.style.padding = "0";
    optionButton.style.border = "1px solid rgba(0, 0, 0, 0.2)";
    optionButton.style.borderRadius = "4px";
    optionButton.style.background = level === speedLevel ? "rgba(0, 123, 255, 0.9)" : "rgba(255, 255, 255, 1)";
    optionButton.style.color = level === speedLevel ? "#fff" : "#333";
    optionButton.style.cursor = "pointer";
    optionButton.style.fontSize = "11px";
    optionButton.style.fontWeight = "600";

    optionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      speedLevel = level;
      refreshSpeedMenuState();
      scheduleMenuAutoHide();
    });

    return optionButton;
  }

  const speedOptions = [1, 2, 3, 4, 5].map((level) => createSpeedOption(level));
  speedOptions.forEach((option) => speedMenuRow.appendChild(option));

  function refreshSpeedMenuState() {
    speedOptions.forEach((option, index) => {
      const level = index + 1;
      option.style.background = level === speedLevel ? "rgba(0, 123, 255, 0.9)" : "rgba(255, 255, 255, 1)";
      option.style.color = level === speedLevel ? "#fff" : "#333";
    });
  }

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgba(255, 255, 255, 1)";
    button.style.borderColor = "rgba(0, 123, 255, 0.8)";
  });

  button.addEventListener("mouseleave", () => {
    if (!scrolling) {
      button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      button.style.borderColor = "rgba(255, 255, 255, 0.5)";
    }
  });

  function stepScroll(timestamp) {
    if (!scrolling) return;

    if (lastRafTimestamp !== null) {
      const elapsed = Math.min((timestamp - lastRafTimestamp) / 1000, 0.1); // cap at 100 ms to avoid jumps after tab-switch

      // Convert pixels/second → degrees/second at the current zoom level.
      // At zoom z: map width = 256 * 2^z pixels for 360°, so px/deg = (256 * 2^z) / 360.
      const pixelsPerSecond = AUTO_SCROLL_SPEED_LEVELS[speedLevel] ?? AUTO_SCROLL_SPEED_LEVELS[DEFAULT_SPEED_LEVEL];
      const zoom = map.getCamera().zoom;
      const pixelsPerDegree = (256 * Math.pow(2, zoom)) / 360;
      const degreesPerSecond = pixelsPerSecond / pixelsPerDegree;

      // Accumulate — don't call setCamera until we have at least 1 px of real movement.
      pendingLongitude += degreesPerSecond * elapsed;
      const onePxInDegrees = 1 / pixelsPerDegree;

      if (pendingLongitude >= onePxInDegrees) {
        const camera = map.getCamera();
        let newCenter = [...camera.center];

        if (AUTO_SCROLL_DIRECTION === "right") {
          newCenter[0] += pendingLongitude;
          if (newCenter[0] > MAX_LONGITUDE) newCenter[0] -= 360;
        } else {
          newCenter[0] -= pendingLongitude;
          if (newCenter[0] < MIN_LONGITUDE) newCenter[0] += 360;
        }

        map.setCamera({ center: newCenter, type: "jump" });
        pendingLongitude = 0;
      }
    }

    lastRafTimestamp = timestamp;
    rafId = requestAnimationFrame(stepScroll);
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    scrolling = !scrolling;

    if (scrolling) {
      button.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
      button.style.color = "#fff";
      button.style.borderColor = "rgba(0, 123, 255, 1)";
      refreshSpeedMenuState();
      speedMenu.style.display = "block";
      scheduleMenuAutoHide();
      lastRafTimestamp = null;
      rafId = requestAnimationFrame(stepScroll);
    } else {
      button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      button.style.color = "#333";
      button.style.borderColor = "rgba(255, 255, 255, 0.5)";
      speedMenu.style.display = "none";
      clearMenuAutoHide();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastRafTimestamp = null;
      pendingLongitude = 0;
    }
  });

  document.addEventListener("click", () => {
    if (scrolling) {
      speedMenu.style.display = "none";
      clearMenuAutoHide();
    }
  });

  speedMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  speedMenu.addEventListener("mouseenter", () => {
    clearMenuAutoHide();
  });

  speedMenu.addEventListener("mouseleave", () => {
    if (scrolling) {
      scheduleMenuAutoHide();
    }
  });

  control.appendChild(speedMenu);
  control.appendChild(button);
  document.body.appendChild(control);

  return control;
}

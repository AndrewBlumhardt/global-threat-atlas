// Constants for auto-scroll behavior
// Speed levels are intentionally simple (1-5) so operators can adjust motion quickly on big displays.
const AUTO_SCROLL_SPEED_LEVELS = {
  1: 0.04,
  2: 0.07,
  3: 0.1,
  4: 0.14,
  5: 0.18,
};
const DEFAULT_SPEED_LEVEL = 3;
const AUTO_SCROLL_DIRECTION = "right"; // "left" or "right"
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;

export function addAutoScrollControl(map) {
  let scrolling = false;
  let animationFrameId = null;
  let speedLevel = DEFAULT_SPEED_LEVEL;

  const control = document.createElement("div");
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

  // Small speed button keeps UI non-intrusive while still making speed easy to adjust.
  const speedButton = document.createElement("button");
  speedButton.className = "azure-maps-control-button";
  speedButton.title = "Auto Scroll Speed";
  speedButton.textContent = String(speedLevel);
  speedButton.style.fontSize = "12px";
  speedButton.style.fontWeight = "700";
  speedButton.style.width = "24px";
  speedButton.style.height = "24px";
  speedButton.style.padding = "0";
  speedButton.style.marginLeft = "6px";
  speedButton.style.border = "2px solid rgba(255, 255, 255, 0.5)";
  speedButton.style.borderRadius = "4px";
  speedButton.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  speedButton.style.color = "#333";
  speedButton.style.cursor = "pointer";
  speedButton.style.transition = "all 0.2s";

  // Compact popup menu for speed level selection (1-5).
  const speedMenu = document.createElement("div");
  speedMenu.style.position = "absolute";
  speedMenu.style.bottom = "38px";
  speedMenu.style.right = "0";
  speedMenu.style.display = "none";
  speedMenu.style.padding = "6px";
  speedMenu.style.background = "rgba(255, 255, 255, 0.95)";
  speedMenu.style.border = "1px solid rgba(0, 0, 0, 0.15)";
  speedMenu.style.borderRadius = "6px";
  speedMenu.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.25)";
  speedMenu.style.zIndex = "1001";

  const speedMenuRow = document.createElement("div");
  speedMenuRow.style.display = "flex";
  speedMenuRow.style.gap = "4px";
  speedMenu.appendChild(speedMenuRow);

  function createSpeedOption(level) {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.textContent = String(level);
    optionButton.title = `Set auto scroll speed to ${level}`;
    optionButton.style.width = "24px";
    optionButton.style.height = "24px";
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
      speedButton.textContent = String(speedLevel);
      refreshSpeedMenuState();
      speedMenu.style.display = "none";
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

  function scroll() {
    if (!scrolling) return;

    const camera = map.getCamera();
    let newCenter = [...camera.center];
    const speed = AUTO_SCROLL_SPEED_LEVELS[speedLevel] ?? AUTO_SCROLL_SPEED_LEVELS[DEFAULT_SPEED_LEVEL];

    if (AUTO_SCROLL_DIRECTION === "right") {
      newCenter[0] += speed;
      if (newCenter[0] > MAX_LONGITUDE) {
        newCenter[0] = MIN_LONGITUDE;
      }
    } else {
      newCenter[0] -= speed;
      if (newCenter[0] < MIN_LONGITUDE) {
        newCenter[0] = MAX_LONGITUDE;
      }
    }

    map.setCamera({
      center: newCenter,
      type: "ease",
      duration: 50,
    });

    animationFrameId = requestAnimationFrame(scroll);
  }

  button.addEventListener("click", () => {
    scrolling = !scrolling;

    if (scrolling) {
      button.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
      button.style.color = "#fff";
      button.style.borderColor = "rgba(0, 123, 255, 1)";
      scroll();
    } else {
      button.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      button.style.color = "#333";
      button.style.borderColor = "rgba(255, 255, 255, 0.5)";
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  });

  speedButton.addEventListener("mouseenter", () => {
    speedButton.style.backgroundColor = "rgba(255, 255, 255, 1)";
    speedButton.style.borderColor = "rgba(0, 123, 255, 0.8)";
  });

  speedButton.addEventListener("mouseleave", () => {
    speedButton.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    speedButton.style.borderColor = "rgba(255, 255, 255, 0.5)";
  });

  // Click the speed badge to open/close a small context menu.
  speedButton.addEventListener("click", (event) => {
    event.stopPropagation();
    speedMenu.style.display = speedMenu.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", () => {
    speedMenu.style.display = "none";
  });

  control.style.display = "flex";
  control.style.alignItems = "center";
  control.style.gap = "0";
  control.style.position = "fixed";
  control.style.bottom = "145px";
  control.style.right = "10px";

  control.appendChild(speedMenu);
  control.appendChild(button);
  control.appendChild(speedButton);
  document.body.appendChild(control);

  return control;
}

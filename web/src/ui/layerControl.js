/**
 * Layer Control Panel
 * Allows users to toggle different data layers on/off
 */

let isExpanded = false;
let currentState = {
  threatActors: false,
  threatActorsMode: 'heatmap', // 'heatmap' or 'country'
  threatIntel: false,
  signInActivity: false,
  deviceLocations: false
};

let onLayerToggle = null;

/**
 * Initialize the layer control panel
 * @param {Function} toggleCallback - Called when layer state changes: (layerType, enabled, mode?) => void
 */
export function initLayerControl(toggleCallback) {
  onLayerToggle = toggleCallback;
  
  const container = document.getElementById('layerControl');
  if (!container) {
    console.error('Layer control container not found');
    return;
  }

  // Toggle button
  const toggleBtn = container.querySelector('.layer-control-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      container.classList.toggle('expanded', isExpanded);
    });
  }

  // Threat Actors toggle
  const taCheckbox = document.getElementById('layerThreatActors');
  if (taCheckbox) {
    taCheckbox.addEventListener('change', async (e) => {
      currentState.threatActors = e.target.checked;
      if (onLayerToggle) {
        await onLayerToggle('threatActors', e.target.checked, currentState.threatActorsMode);
      }
      // Show/hide mode selector
      const modeSelector = document.getElementById('threatActorsMode');
      if (modeSelector) {
        modeSelector.style.display = e.target.checked ? 'flex' : 'none';
      }
    });
  }

  // Threat Actors mode selector
  const modeButtons = document.querySelectorAll('.ta-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (mode === currentState.threatActorsMode) return;
      
      currentState.threatActorsMode = mode;
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (currentState.threatActors && onLayerToggle) {
        await onLayerToggle('threatActors', true, mode);
      }
    });
  });

  // Threat Intel toggle
  const tiCheckbox = document.getElementById('layerThreatIntel');
  if (tiCheckbox) {
    tiCheckbox.addEventListener('change', async (e) => {
      currentState.threatIntel = e.target.checked;
      if (onLayerToggle) {
        await onLayerToggle('threatIntel', e.target.checked);
      }
    });
  }

  // Sign-In Activity toggle (disabled for now)
  const saCheckbox = document.getElementById('layerSignInActivity');
  if (saCheckbox) {
    saCheckbox.addEventListener('change', async (e) => {
      currentState.signInActivity = e.target.checked;
      if (onLayerToggle) {
        await onLayerToggle('signInActivity', e.target.checked);
      }
    });
  }

  // Device Locations toggle (disabled for now)
  const dlCheckbox = document.getElementById('layerDeviceLocations');
  if (dlCheckbox) {
    dlCheckbox.addEventListener('change', async (e) => {
      currentState.deviceLocations = e.target.checked;
      if (onLayerToggle) {
        await onLayerToggle('deviceLocations', e.target.checked);
      }
    });
  }
}

/**
 * Update the enabled/disabled state of layer checkboxes based on data availability
 */
export function updateLayerAvailability(layerType, available) {
  const checkbox = document.getElementById(`layer${layerType.charAt(0).toUpperCase() + layerType.slice(1)}`);
  if (checkbox) {
    checkbox.disabled = !available;
    const label = checkbox.closest('.layer-item');
    if (label) {
      label.classList.toggle('disabled', !available);
    }
  }
}

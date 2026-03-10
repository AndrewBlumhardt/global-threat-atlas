/* global */

/**
 * Populate the left panel with custom source item details
 */
export function showCustomSourceDetails(customData) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  const { location, count, radius, items } = customData;

  // Clear any existing content and event listeners
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // Update panel content section
  titleEl.textContent = location || "Custom Source Area";
  
  metaEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>${count}</strong> custom item${count !== 1 ? "s" : ""} within <strong>${radius} km</strong>
    </div>
  `;

  // Build item list
  if (items && items.length > 0) {
    const itemHtml = items.map(item => {
      const name = item.name || "Unnamed";
      const city = item.city || "";
      const country = item.country || "";
      const locationStr = [city, country].filter(Boolean).join(", ");
      const type = item.type || "";
      const distance = item.distance || 0;
      
      // Get additional properties to display
      const additionalProps = [];
      if (item.properties) {
        Object.keys(item.properties).forEach(key => {
          if (key !== 'name' && key !== 'Name' && key !== 'title' && key !== 'Title' &&
              key !== 'City' && key !== 'city' && key !== 'Country' && key !== 'country' &&
              key !== 'type' && key !== 'Type' && key !== 'Shape' && key !== 'geometry' && key !== 'location') {
            additionalProps.push({ key, value: item.properties[key] });
          }
        });
      }

      return `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(name)}</div>
              ${locationStr ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">${escapeHtml(locationStr)}</div>` : ""}
              ${type ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">
                <span style="display: inline-block; padding: 2px 8px; background: rgba(147, 51, 234, 0.2); border-radius: 4px; font-size: 11px;">
                  ${escapeHtml(type)}
                </span>
              </div>` : ""}
            </div>
            <div style="margin-left: 8px; font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;">
              ${distance.toFixed(1)} km
            </div>
          </div>
          ${additionalProps.length > 0 ? additionalProps.map(prop => 
            `<div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px;"><strong>${escapeHtml(prop.key)}:</strong> ${escapeHtml(String(prop.value))}</div>`
          ).join('') : ''}
        </div>
      `;
    }).join("");

    listEl.innerHTML = itemHtml;
  } else {
    listEl.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No custom items found in this area</div>`;
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  
  // Hide floating threat map button since panel has its own button
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Populate the left panel with nearby IP details
 */
export function showIPDetails(ipData) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  const { location, count, radius, ips } = ipData;

  // Clear any existing content and event listeners
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // Update panel content section
  titleEl.textContent = location || "Selected Area";
  
  metaEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>${count}</strong> threat intel IP${count !== 1 ? "s" : ""} within <strong>${radius} km</strong>
    </div>
  `;

  // Build IP list
  if (ips && ips.length > 0) {
    const ipItems = ips.map(ip => {
      const ipAddress = ip.ip || "Unknown";
      const city = ip.city || "";
      const country = ip.country || "";
      const locationStr = [city, country].filter(Boolean).join(", ");
      const type = ip.type || "";
      const label = ip.label || "";
      const confidence = ip.confidence || "";
      const description = ip.description || "";
      const sourceSystem = ip.sourceSystem || "";
      const created = ip.created || "";
      const distance = ip.distance || 0;
      
      // Format created date
      let createdStr = "";
      if (created) {
        try {
          createdStr = new Date(created).toLocaleString();
        } catch (e) {
          createdStr = created;
        }
      }

      return `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; word-break: break-all;"><strong>IP:</strong> ${escapeHtml(ipAddress)}</div>
              ${locationStr ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">${escapeHtml(locationStr)}</div>` : ""}
              ${type ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">
                <span style="display: inline-block; padding: 2px 8px; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 11px;">
                  ${escapeHtml(type)}
                </span>
              </div>` : ""}
              ${label ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 2px;"><strong>Label:</strong> ${escapeHtml(label)}</div>` : ""}
            </div>
            <div style="display: flex; gap: 6px; margin-left: 8px; align-items: start;">
              <button class="ip-vt-btn" data-ip="${escapeHtml(ipAddress)}" style="padding: 6px 10px; background: #0078d4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;" title="Search VirusTotal">VT Search</button>
              <button class="ip-ai-btn" data-ip="${escapeHtml(ipAddress)}" data-location="${escapeHtml(locationStr)}" data-type="${escapeHtml(type)}" data-label="${escapeHtml(label)}" data-description="${escapeHtml(description)}" style="padding: 6px 10px; background: #10b981; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;" title="Copy AI prompt to clipboard">AI Prompt</button>
            </div>
          </div>
          <div style="margin-left: 0; font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">
            ${distance.toFixed(1)} km away
          </div>
          ${confidence ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>Confidence:</strong> ${escapeHtml(confidence)}</div>` : ""}
          ${description ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; margin-bottom: 6px;">${escapeHtml(description)}</div>` : ""}
          ${sourceSystem ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 2px;"><strong>Source:</strong> ${escapeHtml(sourceSystem)}</div>` : ""}
          ${createdStr ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4);"><strong>Created:</strong> ${escapeHtml(createdStr)}</div>` : ""}
        </div>
      `;
    }).join("");

    listEl.innerHTML = ipItems;
    
    // Wire up VirusTotal search buttons
    document.querySelectorAll(".ip-vt-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ip = e.target.getAttribute("data-ip");
        window.open(`https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}`, "_blank");
      });
    });
    
    // Wire up AI prompt buttons
    document.querySelectorAll(".ip-ai-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ip = e.target.getAttribute("data-ip");
        const location = e.target.getAttribute("data-location");
        const type = e.target.getAttribute("data-type");
        const label = e.target.getAttribute("data-label");
        const description = e.target.getAttribute("data-description");
        
        const prompt = `Provide a comprehensive threat intelligence analysis for IP address ${ip}. Include:

1. Current threat classification and reputation
2. ${location ? `Geographic location: ${location}` : "Geographic attribution"}
3. ${type ? `Threat type: ${type}` : "Identified threat types and behaviors"}
4. ${label ? `Known associations: ${label}` : "Known malicious associations or campaigns"}
5. MITRE ATT&CK techniques observed from this IP
6. Historical activity and timeline
7. Infrastructure analysis (ASN, hosting provider, related IPs)
8. Recommended blocking/monitoring strategies
9. IOCs and detection signatures
${description ? `\nAdditional context: ${description}` : ""}

Please provide detailed, actionable intelligence suitable for security operations and incident response teams.`;
        
        // Copy to clipboard with subtle confirmation
        navigator.clipboard.writeText(prompt).then(() => {
          const originalText = e.target.textContent;
          const originalBg = e.target.style.background;
          
          // Show confirmation
          e.target.textContent = "✓ Copied!";
          e.target.style.background = "#059669";
          
          // Restore after 2 seconds
          setTimeout(() => {
            e.target.textContent = originalText;
            e.target.style.background = originalBg;
          }, 2000);
        }).catch(() => {
          // Fallback: show prompt in alert
          alert("Copy this prompt:\n\n" + prompt);
        });
      });
    });
  } else {
    listEl.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No threat intel IPs found in this area</div>`;
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  
  // Hide floating threat map button since panel has its own button
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Populate the left panel with country threat actor details
 */
export function showCountryDetails(countryProps) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  const { country, count, actors } = countryProps;

  // Clear any existing content and event listeners
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // Update panel content section
  titleEl.textContent = country || "Unknown Country";
  
  metaEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>${count}</strong> threat actor${count !== 1 ? "s" : ""} identified
    </div>
  `;

  // Build actor list
  if (actors && actors.length > 0) {
    const actorItems = actors.map(actor => {
      const name = actor.Name || "Unknown";
      const motivation = actor.Motivation || "Unknown";
      const source = actor.Source || "";
      const otherNames = actor["Other names"] || "";

      return `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(name)}</div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">
                <span style="display: inline-block; padding: 2px 8px; background: rgba(59, 130, 246, 0.2); border-radius: 4px; font-size: 11px;">
                  ${escapeHtml(motivation)}
                </span>
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-left: 8px;">
              <button class="actor-search-btn" data-name="${escapeHtml(name)}" data-aka="${escapeHtml(otherNames)}" style="padding: 6px 10px; background: #0078d4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;" title="Search Bing">Search</button>
              <button class="actor-ai-btn" data-name="${escapeHtml(name)}" data-motivation="${escapeHtml(motivation)}" data-aka="${escapeHtml(otherNames)}" style="padding: 6px 10px; background: #10b981; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;" title="Copy AI prompt to clipboard">AI Prompt</button>
            </div>
          </div>
          ${otherNames ? `<div style="font-size: 12px; color: rgba(255,255,255,0.5);">aka: ${escapeHtml(otherNames)}</div>` : ""}
          ${source ? `<div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">Source: ${escapeHtml(source)}</div>` : ""}
        </div>
      `;
    }).join("");

    listEl.innerHTML = actorItems;
    
    // Wire up search buttons
    document.querySelectorAll(".actor-search-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const name = e.target.getAttribute("data-name");
        const aka = e.target.getAttribute("data-aka");
        const searchTerms = aka ? `${name} ${aka} threat actor` : `${name} threat actor`;
        const query = encodeURIComponent(searchTerms);
        window.open(`https://www.bing.com/search?q=${query}`, "_blank");
      });
    });
    
    // Wire up AI prompt buttons
    document.querySelectorAll(".actor-ai-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const name = e.target.getAttribute("data-name");
        const motivation = e.target.getAttribute("data-motivation");
        const aka = e.target.getAttribute("data-aka");
        
        const prompt = `Provide a comprehensive threat intelligence briefing on the ${name} cyber threat actor group${aka ? ` (also known as: ${aka})` : ""}. Include:

1. Overview and attribution
2. Primary motivations: ${motivation}
3. Known tactics, techniques, and procedures (TTPs)
4. MITRE ATT&CK framework mappings
5. Target sectors and geographies
6. Notable campaigns and incidents
7. Indicators of compromise (IOCs) if known
8. Recommended defensive measures

Please provide detailed, actionable intelligence suitable for security operations teams.`;
        
        // Copy to clipboard with subtle confirmation
        navigator.clipboard.writeText(prompt).then(() => {
          const originalText = e.target.textContent;
          const originalBg = e.target.style.background;
          
          // Show confirmation
          e.target.textContent = "✓ Copied!";
          e.target.style.background = "#059669";
          
          // Restore after 2 seconds
          setTimeout(() => {
            e.target.textContent = originalText;
            e.target.style.background = originalBg;
          }, 2000);
        }).catch(() => {
          // Fallback: show prompt in alert
          alert("Copy this prompt:\n\n" + prompt);
        });
      });
    });
  } else {
    listEl.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No actors found</div>`;
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  
  // Hide floating threat map button since panel has its own button
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Populate the left panel with nearby sign-in activity details
 */
export function showSignInDetails(signInData) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  const { location, count, radius, signIns, threatIntelIPs } = signInData;

  // Clear any existing content
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // Update panel content section
  titleEl.textContent = location || "Selected Area - Sign-Ins";
  
  metaEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>${count}</strong> sign-in${count !== 1 ? "s" : ""} within <strong>${radius} km</strong>
      ${threatIntelIPs && threatIntelIPs.length > 0 ? `<br><span style="color: #ef4444; font-weight: 600;">${threatIntelIPs.length} related threat intel IP${threatIntelIPs.length !== 1 ? "s" : ""} detected</span>` : ""}
    </div>
  `;

  // Build sign-in list
  if (signIns && signIns.length > 0) {
    const signInItems = signIns.map(signIn => {
      const user = signIn.user || "Unknown";
      const userPrincipal = signIn.userPrincipal || "";
      const ip = signIn.ip || "";
      const city = signIn.city || "";
      const country = signIn.country || "";
      const locationStr = [city, country].filter(Boolean).join(", ");
      const result = signIn.result || "";
      const resource = signIn.resource || "";
      const browser = signIn.browser || "";
      const os = signIn.os || "";
      const deviceId = signIn.deviceId || "";
      const isMsIP = signIn.isMsIP === true;
      const isCompliant = signIn.isCompliant === true;
      const isManaged = signIn.isManaged === true;
      const riskState = signIn.riskState || "";
      const riskReason = signIn.riskReason || "";
      const caStatus = signIn.caStatus || "";
      const distance = signIn.distance || 0;
      const time = signIn.time ? new Date(signIn.time).toLocaleString() : "";
      
      const isSuccess = result === "SUCCESS" || result.toLowerCase() === "success";
      const resultColor = isSuccess ? "#10b981" : "#ef4444";
      const hasRisk = riskState && riskState.toLowerCase() !== "none";

      return `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${escapeHtml(user)}</div>
              ${userPrincipal ? `<div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 6px; font-family: monospace;">${escapeHtml(userPrincipal)}</div>` : ""}
              ${locationStr ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">📍 ${escapeHtml(locationStr)}</div>` : ""}
              <div style="margin-bottom: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
                <span style="display: inline-block; padding: 3px 8px; background: ${resultColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(result)}</span>
                ${isMsIP ? `<span style="display: inline-block; padding: 3px 8px; background: #059669; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">MS IP</span>` : ""}
                ${isManaged ? `<span style="display: inline-block; padding: 3px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Managed</span>` : ""}
                ${isCompliant ? `<span style="display: inline-block; padding: 3px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Compliant</span>` : ""}
                ${hasRisk ? `<span style="display: inline-block; padding: 3px 8px; background: #ef4444; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">⚠️ ${escapeHtml(riskState)}</span>` : ""}
              </div>
            </div>
            <div style="margin-left: 8px; font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;">
              ${distance.toFixed(1)} km
            </div>
          </div>
          ${resource ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>App:</strong> ${escapeHtml(resource)}</div>` : ""}
          ${ip ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span><strong>IP:</strong> ${escapeHtml(ip)}</span>
            <button class="signin-ip-vt-btn" data-ip="${escapeHtml(ip)}" style="padding: 4px 8px; background: #0078d4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 10px; font-weight: 600; white-space: nowrap;" title="Search VirusTotal">VT Search</button>
          </div>` : ""}
          ${riskReason ? `<div style="font-size: 11px; color: #ef4444; margin-bottom: 4px;"><strong>Risk:</strong> ${escapeHtml(riskReason)}</div>` : ""}
          ${caStatus ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>CA Status:</strong> ${escapeHtml(caStatus)}</div>` : ""}
          ${os ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>OS:</strong> ${escapeHtml(os)}</div>` : ""}
          ${browser ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>Browser:</strong> ${escapeHtml(browser)}</div>` : ""}
          ${deviceId ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px; font-family: monospace;">${escapeHtml(deviceId.substring(0, 16))}...</div>` : ""}
          ${time ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px;">${escapeHtml(time)}</div>` : ""}
        </div>
      `;
    }).join("");

    listEl.innerHTML = signInItems;
    
    // Wire up VT Search buttons for sign-in IPs
    document.querySelectorAll(".signin-ip-vt-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ip = e.target.getAttribute("data-ip");
        window.open(`https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}`, "_blank");
      });
    });
    
    // Add threat intel IP section if any related IPs found
    if (threatIntelIPs && threatIntelIPs.length > 0) {
      const threatSection = document.createElement("div");
      threatSection.style.marginTop = "16px";
      threatSection.style.borderTop = "2px solid rgba(239, 68, 68, 0.3)";
      threatSection.style.paddingTop = "16px";
      
      const threatHeader = document.createElement("div");
      threatHeader.style.padding = "0 12px 12px 12px";
      threatHeader.style.fontWeight = "600";
      threatHeader.style.fontSize = "14px";
      threatHeader.style.color = "#ef4444";
      threatHeader.textContent = `⚠️ Related Threat Intel IPs (${threatIntelIPs.length})`;
      
      threatSection.appendChild(threatHeader);
      
      const threatItems = threatIntelIPs.map(ti => {
        return `
          <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(239, 68, 68, 0.05);">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; word-break: break-all;"><strong>IP:</strong> ${escapeHtml(ti.ip)}</div>
            ${ti.city || ti.country ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">${escapeHtml([ti.city, ti.country].filter(Boolean).join(", "))}</div>` : ""}
            ${ti.type ? `<div style="margin-bottom: 4px;"><span style="display: inline-block; padding: 2px 8px; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 11px;">${escapeHtml(ti.type)}</span></div>` : ""}
            ${ti.label ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>Label:</strong> ${escapeHtml(ti.label)}</div>` : ""}
            ${ti.confidence ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>Confidence:</strong> ${escapeHtml(ti.confidence)}</div>` : ""}
            ${ti.description ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">${escapeHtml(ti.description)}</div>` : ""}
          </div>
        `;
      }).join("");
      
      threatSection.innerHTML += threatItems;
      listEl.appendChild(threatSection);
    }
  } else {
    listEl.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No sign-ins found in this area</div>`;
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Populate the left panel with nearby device location details
 */
export function showDeviceDetails(deviceData) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  const { location, count, radius, devices, threatIntelIPs } = deviceData;

  // Clear any existing content
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // Update panel content section
  titleEl.textContent = location || "Selected Area - Devices";
  
  metaEl.innerHTML = `
    <div style="margin-bottom: 16px;">
      <strong>${count}</strong> device${count !== 1 ? "s" : ""} within <strong>${radius} km</strong>
      ${threatIntelIPs && threatIntelIPs.length > 0 ? `<br><span style="color: #ef4444; font-weight: 600;">${threatIntelIPs.length} related threat intel IP${threatIntelIPs.length !== 1 ? "s" : ""} detected</span>` : ""}
    </div>
  `;

  // Build device list
  if (devices && devices.length > 0) {
    const deviceItems = devices.map(device => {
      const name = device.name || "Unknown";
      const deviceId = device.deviceId || "";
      const deviceType = device.deviceType || "";
      const user = device.user || "";
      const userPrincipal = device.userPrincipal || "";
      const ip = device.ip || "";
      const city = device.city || "";
      const country = device.country || "";
      const locationStr = [city, country].filter(Boolean).join(", ");
      const os = device.os || "";
      const browser = device.browser || "";
      const isMsIP = device.isMsIP === true;
      const isCompliant = device.isCompliant === true;
      const isManaged = device.isManaged === true;
      const cloudPlatform = device.cloudPlatform || "";
      const sensorHealth = device.sensorHealth || "";
      const exposureLevel = device.exposureLevel || "";
      const distance = device.distance || 0;
      const time = device.time ? new Date(device.time).toLocaleString() : "";
      
      const exposureColor = 
        exposureLevel === "High" ? "#ef4444" :
        exposureLevel === "Medium" ? "#f59e0b" :
        exposureLevel === "Low" ? "#10b981" : "#6b7280";
      const healthColor = sensorHealth === "Active" ? "#10b981" : "#f59e0b";
      const deviceTypeIcon = (deviceType === "Mobile" || deviceType === "Tablet") ? "📱" : "💻";

      return `
        <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${deviceTypeIcon} ${escapeHtml(name)}</div>
              ${user ? `<div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">👤 ${escapeHtml(user)}</div>` : ""}
              ${locationStr ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">📍 ${escapeHtml(locationStr)}</div>` : ""}
              <div style="margin-bottom: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
                ${exposureLevel ? `<span style="display: inline-block; padding: 3px 8px; background: ${exposureColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(exposureLevel)} Risk</span>` : ""}
                ${sensorHealth ? `<span style="display: inline-block; padding: 3px 8px; background: ${healthColor}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(sensorHealth)}</span>` : ""}
                ${isMsIP ? `<span style="display: inline-block; padding: 3px 8px; background: #059669; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">MS IP</span>` : ""}
                ${isManaged ? `<span style="display: inline-block; padding: 3px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Managed</span>` : ""}
                ${isCompliant ? `<span style="display: inline-block; padding: 3px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">Compliant</span>` : ""}
              </div>
            </div>
            <div style="margin-left: 8px; font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap;">
              ${distance.toFixed(1)} km
            </div>
          </div>
          ${deviceType ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>Type:</strong> ${escapeHtml(deviceType)}</div>` : ""}
          ${cloudPlatform ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>Platform:</strong> ${escapeHtml(cloudPlatform)}</div>` : ""}
          ${os ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>OS:</strong> ${escapeHtml(os)}</div>` : ""}
          ${browser ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 2px;"><strong>Browser:</strong> ${escapeHtml(browser)}</div>` : ""}
          ${ip ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span><strong>IP:</strong> ${escapeHtml(ip)}</span>
            <button class="device-ip-vt-btn" data-ip="${escapeHtml(ip)}" style="padding: 4px 8px; background: #0078d4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 10px; font-weight: 600; white-space: nowrap;" title="Search VirusTotal">VT Search</button>
          </div>` : ""}
          ${deviceId ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px; font-family: monospace;">${escapeHtml(deviceId.substring(0, 16))}...</div>` : ""}
          ${time ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px;">Last seen: ${escapeHtml(time)}</div>` : ""}
        </div>
      `;
    }).join("");

    listEl.innerHTML = deviceItems;
    
    // Wire up VT Search buttons for device IPs
    document.querySelectorAll(".device-ip-vt-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ip = e.target.getAttribute("data-ip");
        window.open(`https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}`, "_blank");
      });
    });
    
    // Add threat intel IP section if any related IPs found
    if (threatIntelIPs && threatIntelIPs.length > 0) {
      const threatSection = document.createElement("div");
      threatSection.style.marginTop = "16px";
      threatSection.style.borderTop = "2px solid rgba(239, 68, 68, 0.3)";
      threatSection.style.paddingTop = "16px";
      
      const threatHeader = document.createElement("div");
      threatHeader.style.padding = "0 12px 12px 12px";
      threatHeader.style.fontWeight = "600";
      threatHeader.style.fontSize = "14px";
      threatHeader.style.color = "#ef4444";
      threatHeader.textContent = `⚠️ Related Threat Intel IPs (${threatIntelIPs.length})`;
      
      threatSection.appendChild(threatHeader);
      
      const threatItems = threatIntelIPs.map(ti => {
        return `
          <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(239, 68, 68, 0.05);">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; word-break: break-all;"><strong>IP:</strong> ${escapeHtml(ti.ip)}</div>
            ${ti.city || ti.country ? `<div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">${escapeHtml([ti.city, ti.country].filter(Boolean).join(", "))}</div>` : ""}
            ${ti.type ? `<div style="margin-bottom: 4px;"><span style="display: inline-block; padding: 2px 8px; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 11px;">${escapeHtml(ti.type)}</span></div>` : ""}
            ${ti.label ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>Label:</strong> ${escapeHtml(ti.label)}</div>` : ""}
            ${ti.confidence ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"><strong>Confidence:</strong> ${escapeHtml(ti.confidence)}</div>` : ""}
            ${ti.description ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">${escapeHtml(ti.description)}</div>` : ""}
          </div>
        `;
      }).join("");
      
      threatSection.innerHTML += threatItems;
      listEl.appendChild(threatSection);
    }
  } else {
    listEl.innerHTML = `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No devices found in this area</div>`;
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Populate the left panel with MaxMind GeoIP2 IP lookup details
 */
export function showIPLookupDetails(data) {
  const panel = document.getElementById("leftPanel");
  const titleEl = document.getElementById("panelTitle");
  const metaEl = document.getElementById("panelMeta");
  const listEl = document.getElementById("panelList");

  if (!panel || !titleEl || !metaEl || !listEl) {
    console.warn("Panel elements not found");
    return;
  }

  // Clear any existing content
  listEl.innerHTML = "";
  metaEl.innerHTML = "";

  // API returns a flat object — map fields directly
  const ip   = data.ip   || "Unknown";
  const city = data.city || "";
  const state = data.state || "";
  const country = data.country || "";
  const isp  = data.isp  || "";
  const org  = data.organization || "";
  const asn  = data.autonomous_system_number;
  const asnOrg = data.autonomous_system_organization || "";

  // Title
  titleEl.textContent = `IP Lookup: ${ip}`;

  // Build risk flag badges
  const riskFlags = [];
  if (data.is_tor_exit_node)   riskFlags.push({ label: "TOR Exit",     bg: "#7c3aed" });
  if (data.is_anonymous_vpn)   riskFlags.push({ label: "VPN",          bg: "#7c3aed" });
  if (data.is_public_proxy)    riskFlags.push({ label: "Proxy",        bg: "#ef4444" });
  if (data.is_anonymous_proxy) riskFlags.push({ label: "Anon Proxy",   bg: "#ef4444" });
  if (data.is_hosting_provider)riskFlags.push({ label: "Hosting",      bg: "#f59e0b" });
  if (data.is_anonymous)       riskFlags.push({ label: "Anonymous",    bg: "#f59e0b" });
  if (data.is_residential_proxy) riskFlags.push({ label: "Res. Proxy", bg: "#f59e0b" });

  const badgesHtml = riskFlags.length > 0
    ? riskFlags.map(f =>
        `<span style="display: inline-block; padding: 2px 8px; background: ${f.bg}; border-radius: 4px; font-size: 11px; font-weight: 600; color: #fff; margin-right: 4px; margin-bottom: 4px;">${f.label}</span>`
      ).join("")
    : `<span style="display: inline-block; padding: 2px 8px; background: rgba(16, 185, 129, 0.2); border-radius: 4px; font-size: 11px; color: #10b981;">No risk flags</span>`;

  const locationStr = [city, state, country].filter(Boolean).join(", ");

  metaEl.innerHTML = `
    <div style="margin-bottom: 12px;">
      ${locationStr ? `<div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">📍 ${escapeHtml(locationStr)}</div>` : ""}
      <div style="margin-bottom: 4px;">${badgesHtml}</div>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <a href="https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}" target="_blank" rel="noopener noreferrer"
        style="padding: 7px 12px; background: #0078d4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-block;">
        VT Search
      </a>
      <button id="ipLookupAiPromptBtn"
        style="padding: 7px 12px; background: #10b981; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600;">
        AI Prompt
      </button>
    </div>
  `;

  // Build detail rows from flat fields
  const rows = [];
  if (data.latitude != null && data.longitude != null) {
    rows.push({ label: "Coordinates", value: `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}` });
  }
  if (data.accuracy_radius)  rows.push({ label: "Accuracy Radius",  value: `±${data.accuracy_radius} km` });
  if (data.time_zone)        rows.push({ label: "Time Zone",        value: data.time_zone });
  if (data.postal_code)      rows.push({ label: "Postal Code",      value: data.postal_code });
  if (isp)                   rows.push({ label: "ISP",              value: isp });
  if (org)                   rows.push({ label: "Organization",     value: org });
  if (asn)                   rows.push({ label: "ASN",              value: `AS${asn}${asnOrg ? " — " + asnOrg : ""}` });
  if (data.domain)           rows.push({ label: "Domain",          value: data.domain });
  if (data.connection_type)  rows.push({ label: "Connection Type", value: data.connection_type });
  if (data.user_type)        rows.push({ label: "User Type",       value: data.user_type });
  if (data.registered_country && data.registered_country !== country) {
    rows.push({ label: "Registered In", value: data.registered_country });
  }

  const rowsHtml = rows.map(r => `
    <div style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: baseline; gap: 12px;">
      <span style="font-size: 12px; color: rgba(255,255,255,0.5); white-space: nowrap; flex-shrink: 0;">${escapeHtml(r.label)}</span>
      <span style="font-size: 13px; color: rgba(255,255,255,0.9); text-align: right; word-break: break-word;">${escapeHtml(String(r.value))}</span>
    </div>
  `).join("");

  listEl.innerHTML = rowsHtml || `<div style="padding: 12px; color: rgba(255,255,255,0.5);">No additional details available</div>`;

  // Wire up AI Prompt button
  const aiBtn = document.getElementById("ipLookupAiPromptBtn");
  if (aiBtn) {
    aiBtn.addEventListener("click", () => {
      const riskList = riskFlags.length > 0 ? riskFlags.map(f => f.label).join(", ") : "none";
      const prompt = `Provide a comprehensive threat intelligence analysis for IP address ${ip}. Include:

1. Current threat classification and reputation
2. Geographic location: ${locationStr || "unknown"}
3. Network info: ISP = ${isp || "unknown"}, Organization = ${org || "unknown"}, ASN = ${asn ? "AS" + asn : "unknown"}
4. Risk flags detected: ${riskList}
5. Connection type: ${data.connection_type || "unknown"}, User type: ${data.user_type || "unknown"}
6. MITRE ATT&CK techniques associated with this type of IP infrastructure
7. Historical activity and known campaigns using this IP, ASN, or hosting provider
8. Recommended blocking, monitoring, and detection strategies
9. Relevant IOCs and detection signatures for SOC use

Please provide detailed, actionable intelligence suitable for security operations and incident response teams.`;

      navigator.clipboard.writeText(prompt).then(() => {
        const orig = aiBtn.textContent;
        aiBtn.textContent = "✓ Copied!";
        aiBtn.style.background = "#059669";
        setTimeout(() => {
          aiBtn.textContent = orig;
          aiBtn.style.background = "#10b981";
        }, 2000);
      }).catch(() => {
        alert("Copy this prompt:\n\n" + prompt);
      });
    });
  }

  // Show panel
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");

  // Hide floating threat map button
  const floatingThreatBtn = document.getElementById("showControlPanel");
  if (floatingThreatBtn) {
    floatingThreatBtn.style.display = "none";
  }
}

/**
 * Hide the left panel
 */
export function hidePanel() {
  const panel = document.getElementById("leftPanel");
  if (panel) {
    // Move focus to a safe element before hiding to prevent aria-hidden accessibility warning
    const hideBtn = document.getElementById("panelHideBtn");
    if (hideBtn && document.activeElement === hideBtn) {
      // Move focus to the map container or body
      const mapContainer = document.getElementById("map");
      if (mapContainer) {
        mapContainer.focus();
      } else {
        document.body.focus();
      }
    }
    
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
  }
  
  // Show floating threat map button when panel is hidden
  const floatingThreatBtn = document.getElementById("showControlPanel");
  const threatControl = document.getElementById("threatActorsControlPanel");
  if (floatingThreatBtn && (!threatControl || threatControl.style.display === "none")) {
    floatingThreatBtn.style.display = "block";
  }
}

/**
 * Initialize panel hide buttons
 */
export function initPanelControls() {
  const hideBtn = document.getElementById("panelHideBtn");
  
  // Close button in panel header
  if (hideBtn) {
    hideBtn.addEventListener("click", hidePanel);
  }
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

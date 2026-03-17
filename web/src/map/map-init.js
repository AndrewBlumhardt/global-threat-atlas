/* global atlas */

function addMapControls(map) {
  map.controls.add(
    [
      new atlas.control.ZoomControl(),
      new atlas.control.PitchControl()
    ],
    { position: "bottom-right" }
  );

  map.controls.add(new atlas.control.CompassControl(), { position: "bottom-left" });

  map.controls.add(
    new atlas.control.FullscreenControl({ hideIfUnsupported: true }),
    { position: "top-right" }
  );

  // Style picker
  map.controls.add(
    new atlas.control.StyleControl({
      mapStyles: [
        "road",
        "grayscale_light",
        "grayscale_dark",
        "night",
        "road_shaded_relief",
        "satellite",
        "satellite_road_labels"
      ]
    }),
    { position: "top-right" }
  );
}

export async function createMap({ containerId, initialView, style, subscriptionKey }) {
  if (!subscriptionKey) {
    throw new Error("createMap: subscriptionKey is required");
  }
  const cfg = { subscriptionKey };

  // authType "subscriptionKey" passes the key with every map tile request.
  // The key itself is never stored in a static file — it comes from /api/config
  // at runtime.  If this deployment needs stricter key hygiene, replace with
  // authType: "aad" and a clientId (Maps account → Azure AD app registration),
  // which issues short-lived tokens and keeps the subscription key server-side.
  const map = new atlas.Map(containerId, {
    center: (initialView && initialView.center) || [-20, 25],
    zoom: (initialView && initialView.zoom) || 2,
    pitch: (initialView && initialView.pitch) || 0,
    bearing: (initialView && initialView.bearing) || 0,
    language: "en-US",
    view: "Auto",
    style: style || "road",
    preserveDrawingBuffer: true,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: cfg.subscriptionKey
    }
  });

  addMapControls(map);
  
  // Return both map and subscription key for use by weather tile layers
  return { map, subscriptionKey: cfg.subscriptionKey };
}

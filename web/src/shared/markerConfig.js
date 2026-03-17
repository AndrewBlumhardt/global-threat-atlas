/**
 * Shared marker size configuration for all map overlays.
 *
 * Change these values to resize all markers across the three data layers at once:
 *
 *   MARKER_SIZE_PX   — diameter (px) of the CSS circle used by the Device Locations
 *                      and Sign-In Activity HTML markers.  The visible dot is this
 *                      value plus the 2 px white border on each side.
 *
 *   BUBBLE_RADIUS_PX — radius (px) of the Azure Maps BubbleLayer used by the
 *                      Threat Intel layer.  Visible diameter = 2 × this value.
 */
export const MARKER_SIZE_PX = 4;
export const BUBBLE_RADIUS_PX = 4;

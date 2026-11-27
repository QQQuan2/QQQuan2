/* ------------------------------------------------------------------ *
 * House 2.0 — unified spatial baseline
 *
 * One lightweight source of truth for the cottage's dimensions and
 * placement, so the exterior shell (house.js) and main.js reason
 * about the same numbers.
 *
 * Coordinate conventions
 * ----------------------
 * Exterior (house.js group):   origin = house centre on its ground
 *   line, +z = front (door + main window), +x = right, y = up.
 *   main.js places the group at (0, surfaceHeight(0,-1.4), -1.4)
 *   with the rotY / scale below.
 * Interior (interior.js scene): origin = room centre on the floor,
 *   +z = front (sea-view window wall), +x = right. The fronts of both
 *   spaces correspond; the interior room is intentionally its own
 *   cozy scale (it does NOT match the exterior footprint 1:1).
 * ------------------------------------------------------------------ */

export const HOUSE = {
  exterior: {
    W: 4.2,        // wall body width (x)
    D: 3.4,        // wall body depth (z)
    H: 2.7,        // wall body height at the eaves
    wallT: 0.16,   // shell wall thickness (real openings)
    ridgeH: 2.15,  // roof rise above the eaves
    baseY: 0.06,   // wall base above the group origin
  },
  placement: {
    rotY: 0.42,    // house yaw on the island (main.js)
    scale: 0.9,    // uniform group scale (main.js)
  },
};

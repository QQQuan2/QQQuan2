/* ------------------------------------------------------------------ *
 * House 2.0 — unified spatial baseline (M1.1)
 *
 * One lightweight source of truth for the cottage's dimensions and
 * placement, so the exterior shell, the (legacy) interior scene and
 * the future attic / loft all reason about the same numbers.
 *
 * Coordinate conventions
 * ----------------------
 * Exterior (house.js group):   origin = house centre on its ground
 *   line, +z = front (door + main window), +x = right, y = up.
 *   main.js places the group at (0, surfaceHeight(0,-1.4), -1.4)
 *   with the rotY / scale below.
 * Interior (interior.js scene): origin = room centre on the floor,
 *   +z = front (sea-view window wall), +x = right. The fronts of both
 *   spaces correspond; door side alignment is handled in M1.2.
 *
 * Known discrepancy (documented, NOT silently patched)
 * ----------------------------------------------------
 * The legacy interior room (6.4 × 5.4) is ~1.5× the exterior
 * footprint (4.2 × 3.4). Re-fitting it safely (same footprint, door
 * and window openings aligned with the shell) is the M2 milestone;
 * until then the two scenes stay separate and this file only records
 * the mapping. Do not blindly scale the interior scene to fit.
 * ------------------------------------------------------------------ */

export const HOUSE = {
  exterior: {
    W: 4.2,        // wall body width (x)
    D: 3.4,        // wall body depth (z)
    H: 2.7,        // wall body height at the eaves
    wallT: 0.16,   // shell wall thickness (M1.2 real openings)
    ridgeH: 2.15,  // roof rise above the eaves
    eave: 0.36,    // roof overhang per side
    baseY: 0.06,   // wall base above the group origin
  },
  interior: {
    // Legacy room, kept unchanged through M1. Door/window openings must
    // line up with the shell's openings when M2 re-fits this space.
    W: 6.4, D: 5.4, wallH: 2.8, ceilY: 2.86,
  },
  attic: {
    // Planning value only — no slab is built in M1. Existing window tops
    // (front glow 2.26 / frame 2.39, side frames 2.26) conflict with this
    // floor level and must be re-designed together with the attic (M2).
    slabY: 1.8,
  },
  placement: {
    rotY: 0.42,    // house yaw on the island (main.js)
    scale: 0.9,    // uniform group scale (main.js)
  },
};

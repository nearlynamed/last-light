# LAST LIGHT

A playable, real-time orbital defense command game. Read the returns, resolve uncertainty, and protect the fictional planet Aster through a five-minute watch.

**[Play LAST LIGHT](https://last-light-five.vercel.app)**

## Run locally

Node.js 22.12+ (24 recommended), pnpm 11.25.

```sh
pnpm install
pnpm dev
```

```sh
pnpm test
pnpm build
pnpm preview
```

## Play

1. Assume command. Select a contact in the track register or on the map.
2. Compare observation age, the estimated atmospheric crossing, and the seven radar window lanes.
3. Select a radar using Network, a map label, or a window lane. Assign Sector or Focus to your selected contact. Broad resumes autonomous search.
4. Choose Deflection for an early redirect or Precision for direct interception. Choose a launch facility with a clear corridor, then commit.
5. Inspect fresh returns after the engagement. A vanished contact is not confirmation of destruction.

Drag to orbit; scroll to zoom. Use the orbital, polar, and side camera presets. Space pauses/resumes. 1×, 2×, and 4× change simulation time. The sound button enables procedural audio. Switching away from the page automatically pauses the simulation; resume explicitly when returning. The field manual leaves the simulation running.

The starting network has four rotating ground radars, three radars in different orbital planes, two launch facilities, four deflection interceptors, and ten precision interceptors. Radar sensitivity trades weak returns against tentative noise contacts. A selected radar has its own schedule and does not change unrelated sensors. Focused tracking supports midcourse updates while an interceptor's terminal seeker still has a finite acquisition envelope.

## What is simulated

- Fixed 30 Hz central-gravity propagation and independently scheduled sensor samples.
- Planet occlusion, radar range, moving beams, scan modes, varying return strength, seeded detection noise, and missed returns.
- Observation history, regression-based velocity estimates, coasting uncertainty, source reports, and a combined estimate.
- Observation-window forecasts computed from estimated trajectories.
- Deflection and precision engagements, finite acquisition, launcher cooldowns, ammunition, fragmentation, and surface impacts.
- A complete timed scenario, terminal journal, debrief, and restart.

The map renders continuously. Last-observation dots stay fixed until a sensor obtains another return. Hollow diamonds and trajectory corridors are estimates. No undiscovered object position, true object properties, or private interception result is exposed through the presentation snapshot. Full outcome counts appear only in the debrief.

## Prototype limits

This is a deliberately compressed fictional orbital system, not an aerospace simulator. The estimator uses a short observation regression and conservative scalar uncertainty, rather than a full covariance filter. Track association is simplified. Sensor visibility windows are approximate, sampled forecasts; they are not promises of detection. Missile flight and seeker logic are simplified. The first watch has a seeded scenario; infrastructure construction, a campaign, and advanced identification/maintenance workflows remain later additions. The five-minute debrief does not prove the long-term safety of every redirected orbit.

## Architecture

- `src/sim/`: renderer-independent truth, sensing, tracking, forecasting, and engagements.
- `src/store.ts`: commands, UI state, and safe presentation snapshots.
- `src/Scene.tsx`: Three.js / React Three Fiber tactical scene.
- `src/App.tsx`: command terminals and mission flow.
- `src/sim/engine.test.ts`: determinism, occlusion, stale estimates, tasking isolation, hidden-state boundaries, ammunition, weapon outcomes, and complete-watch tests.

## Hosting

Vercel uses the Vite preset, `pnpm build`, and `dist/`. No backend, environment variables, or secrets are required. The lockfile and package-manager version are committed for reproducible builds. The game has no analytics or account tracking. Google Fonts is optional: system font fallbacks keep the UI usable if the font request fails.

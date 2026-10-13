# LAST LIGHT — first playable plan

Status: first playable implemented. See README.md for shipped mechanics, controls, verification commands, and prototype limits. The remaining design goals below guide subsequent iterations.

## Product contract

- A browser-based, real-time orbital defense command game.
- Information acquired before an interception deadline is the central resource.
- A genuinely three-dimensional tactical map with smooth camera motion, orbital movement, radar beams, trajectories, and uncertainty volumes.
- Multiple ground stations and multiple orbital radars are part of the first playable. Their geometry, independent scan schedules, and observation windows must materially affect decisions.
- Sensor observations are intermittent and imperfect. Continuous rendering must never imply continuous observation.
- The map and terminals receive estimated tracks, never the hidden truth about undiscovered objects.
- Terminal pages, track lists, sensor controls, weapon orders, and message history remain usable while the simulation runs.

## Recommended stack

| Concern | Choice | Purpose |
| --- | --- | --- |
| Language | TypeScript, strict mode | Explicit types for truth, observations, estimates, and orders |
| Development/build | Vite | Local development and static production bundle |
| Terminal interface | React 19 | Track lists, inspection panels, sensor settings, messages |
| Spatial rendering | Three.js + React Three Fiber 9 | Declarative scene composition with imperative per-frame updates |
| Scene helpers | Selected Drei helpers | Camera controls and useful scene utilities |
| Interface state | Zustand | Selected contact, active terminal, orders, published track snapshots |
| Styling | CSS with shared design tokens | Compact terminal layout and precise visual hierarchy |
| Audio | Native Web Audio initially | Procedural scan, alert, acquisition, and command tones |
| Simulation tests | Vitest | Seeded, repeatable tests of sensing, tracking, and engagements |
| Browser tests | Playwright | Actual start-to-finish gameplay and interface checks |

Start with Three.js WebGLRenderer. Reconsider WebGPU only if profiling identifies a need that outweighs migration cost. React Three Fiber 9 pairs with React 19; verify and lock compatible stable package versions when scaffolding.

Add postprocessing only after the basic frame budget is measured. Use selective bloom on spatial effects, not on terminal text. Add an audio asset library only when the game uses authored sound assets.

The first playable needs no server framework, account system, database, generic rigid-body physics engine, or entity-component framework. Use a focused orbital model, seeded random generation, and explicit interception logic.

## Architecture

1. World: actual object position, velocity, properties, fragments, and engagement effects.
2. Sensors: schedules, geometry, measurement noise, return strength, detection thresholds, missed returns, and station bias.
3. Tracking: observation history, state estimates, uncertainty, candidate identity, disagreements, and contact association.
4. Command: player sensor assignments, engagement plans, launch orders, and standing orders.
5. Presentation: estimated tracks, known friendly telemetry, estimated decision windows, controls, and event messages.

World state is private to the engine. UI-facing snapshot types must not include hidden object identity, true position, true material, or unobserved destruction status.

Keep engine code free of React and renderer dependencies. Use simple vector/matrix types and narrowly scoped math helpers. A worker-compatible command/snapshot boundary should exist from the beginning; move execution to a Web Worker when profiling justifies it.

## Timing and performance

- Render continuously at the display cadence. Target stable 60 fps on the eventual target hardware; measure it rather than promise it.
- Start with a fixed 30 Hz simulation step, subject to profiling and accuracy checks.
- Interpolate known friendly motion and propagate estimated contact motion between updates.
- Give each sensor its own observation schedule. Frame rate must not change observation quality or engagement outcomes.
- Publish terminal snapshots at approximately 5–10 Hz. Immediate user commands and urgent events should not wait for the next normal snapshot.
- Update object transforms through refs/useFrame, not React setState every frame.
- Reuse geometry, materials, and temporary math objects. Cap pixel ratio and bound the number of visible uncertainty volumes.
- Keep measured-position markers distinct from smoothly moving predictions.
- Define and display tab/background suspension behavior; do not silently catch up minutes of simulated catastrophe after browser throttling.

## First scenario

A fictional planet faces a short, escalating debris encounter. The initial tuning target is four ground radar stations, three orbital radar platforms, and two launch facilities. Contacts include a large object suitable for early deflection, a smaller threatening fragment, and a harmless passage.

The large object initially has a poor solution. The next scheduled, useful independent cross-check is projected to arrive after its early deflection window closes. Retasking another radar may provide an earlier observation, at the cost of coverage for a second contact. Network geometry and sensor assignments produce this dilemma; it must not be a scripted restriction that ignores available radars.

### Initial sensor network

| Assets | Placement and behavior | Decision demonstrated |
| --- | --- | --- |
| Four ground stations | Distributed across different longitudes and both hemispheres; move with the rotating planet; independent scan phases and assignments | Overlapping coverage, horizon loss, and handoff between stations |
| Two lower orbital radars | Distinct inclined orbital planes and phases | Moving sightlines, changing observation angles, and shorter visibility windows |
| One higher orbital radar | A different inclination and longer orbital period | A broader geometric view with deliberately limited scan capacity and sensitivity |

Orbit sizes, periods, ranges, and sensor capabilities are gameplay tuning parameters in a compressed fictional system. Extra assets should introduce useful choices while preserving periods of incomplete coverage. Start the radars on sensible automatic search assignments so seven sensors do not demand constant manual clicks.

Each radar has its own scan mode, field of regard, revisit schedule, sensitivity, and tracking capacity. Ground and orbital radars use the same observation pipeline. Being geometrically visible does not guarantee the beam visits the contact or produces a usable return.

### Coverage and projection presentation

- Show actual 3D sensor locations, orbital paths, and independently moving scan beams. Ground coverage is bounded by the local horizon; all sightlines respect planet occlusion.
- Distinguish a sensor's possible coverage volume from its current beam and its predicted opportunity to observe a selected contact.
- A network overview shows restrained coverage and sweep outlines. Selecting a sensor or track reveals detailed volumes, contributing stations, and observation timestamps without flooding the map with opaque overlapping cones.
- The selected contact's timeline includes one lane per relevant radar: predicted visibility intervals, planned revisits, and acquisition/loss of sightline, alongside estimated weapon commit deadlines.
- Derive contact visibility forecasts from the estimated trajectory and its uncertainty. Mark uncertain window boundaries; do not consult hidden true trajectories for a perfectly accurate forecast.
- Allow inspection of individual sensor estimates alongside the combined estimate. Fresh compatible observations from useful angles can narrow the uncertainty volume; repeated, stale, or conflicting evidence must not produce automatic certainty.
- Make handoffs visible: show which sensor last contributed, which can observe next, and how long the contact will coast if no further assignment is made.

### Included systems

- Continuous 3D motion and smooth orbital camera controls, plus polar and side presets.
- Four ground stations and three orbital radars with independent scan schedules, visible beams, coverage overlays, and sensor handoffs.
- Planet occlusion, broad/sector/focused scans, detection threshold control, noisy returns, and occasional failed reacquisition.
- Observation timestamps, tentative contacts, coasting tracks, growing uncertainty, and conflicting station reports.
- Deflection and precision interceptors with distinct information requirements and launch windows.
- Observation-based engagement assessment. Losing a return does not establish destruction.
- Track selection, a decision timeline, sensor assignment, weapon controls, and a timestamped event log.
- Per-sensor observation-window lanes and inspectable individual versus combined track estimates.
- Ammunition constraints, protected planet/station assets, a clear scenario ending, and restart.
- Short onboarding, keyboard-accessible terminal controls, and a debrief that can reveal the true scenario after the watch ends.

### Subsequent additions

- Fragmentation interceptors, point defense, larger fragment clouds, and more advanced identity inference.
- Persistent calibration faults and deeper cross-check/recalibration workflows.
- Infrastructure purchase and placement between watches.
- Civilian traffic, paperwork discrepancies, maintenance, and a campaign.

## Acceptance criteria

1. A contact's last observation moves only when a usable observation arrives.
2. Its prediction moves smoothly and its uncertainty grows while coasting.
3. Planet occlusion and sensor coverage affect actual observations.
4. Focused tracking improves the selected solution at a measurable coverage cost.
5. Lower detection thresholds reveal weak candidates and additional false alarms.
6. Early deflection and later precision interception are both useful in different circumstances.
7. Launching at a stale estimate can fail because the actual object is outside the weapon's reachable/acquisition region.
8. Engagement status is based on sensor or friendly telemetry evidence, never unobserved world truth.
9. Seeded runs produce equivalent simulation results across rendering frame rates.
10. A player can complete the entire scenario, see a debrief, and restart through the interface.
11. Multiple ground and orbital radars are simultaneously operational and independently observable on the 3D map.
12. Changing a radar assignment alters its actual observations and forecast revisit schedule without changing unrelated radar schedules.
13. Compatible independent observations improve the combined track estimate; disagreement remains visible rather than being averaged into unjustified confidence.
14. Observation windows respond to planet rotation, orbital motion, occlusion, scan assignment, and estimated contact motion. Visibility alone never guarantees detection.

## References verified for stack selection

- https://r3f.docs.pmnd.rs/ — React/React Three Fiber major-version compatibility.
- https://r3f.docs.pmnd.rs/api/hooks — per-frame work and avoiding setState in useFrame.
- https://r3f.docs.pmnd.rs/advanced/scaling-performance — instancing and rendering performance.
- https://threejs.org/manual/pages/webgpurenderer — WebGPU/WebGL renderer tradeoffs and migration constraints.
- https://vite.dev/guide/ — Vite setup and current runtime requirements.
- https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector — subscriptions to selected state.

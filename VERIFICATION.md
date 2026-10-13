# First playable verification

## Automated

`pnpm test`: 19 tests passed (Crossing Paths update).

Covered: seven independent sensors, planet occlusion, orbital movement, stale observations, uncertainty growth, frame-cadence determinism, pause/resume, isolated radar tasking, hidden-state boundaries, ammunition/cooldown, observation forecasts, complete-watch termination, successful early deflection with unresolved engagement assessment, precision disruption and new fragment contacts, and finite estimates throughout the watch.

Additional coverage: twelve flybys versus four impactors, three or more close grazes, substantial angular motion even on impact trajectories, conserved orbital energy and the specified closest-pass radius, estimated flyby altitude/time, no future-event disclosure, and a successfully deflected curved impactor with no subsequent surface impact. Weapon tests use a controlled fixture so scenario rebalancing does not invalidate their assumptions about initial track IDs.

`pnpm build`: TypeScript and the Vite production build passed. The Three.js scene chunk is approximately 322 KB compressed; Vite reports a large-chunk advisory. The scene is lazy-loaded and rendering remains continuously active.

## Browser flow

Verified in the Codex in-app browser at the default desktop viewport:

- Briefing -> assume command -> live map and terminal.
- Focus a ground radar on the selected contact.
- Commit a deflection interceptor; ammunition decreases and the launcher cycles.
- Advance at 4x through the complete five-minute watch.
- Debrief reported one deflection hit, one interceptor fired, and 12% planetary integrity with the remaining hazards left unattended.
- Restart returns to the briefing and resets the watch and magazines.
- Pause/resume and camera/view controls are present; changing browser visibility pauses the simulation.

Checked the 390px responsive layout: no horizontal page overflow; map, sensor controls, and engagement panel stack vertically.

Development hot reload produced a React/Drei HTML-root unmount warning during scene reload. The clean local production build and hosted production game had no application console errors during verification. Frame-rate readings observed locally are machine-specific and are not a cross-device performance guarantee.

## Production release

Deployed October 13, 2026 to https://last-light-five.vercel.app under Vercel team `nearlynamed`, project `last-light`. The production build is READY; Vercel completed dependency installation, TypeScript checking, and the Vite build. The GitHub repository `nearlynamed/last-light` is connected with `main` as the production branch.

Verified the public production domain without signing into Vercel: briefing, live 3D scene, focused radar tasking, interceptor launch, ammunition decrement, launcher cooldown, and pause. The protected deployment aliases are separate from the public production domain; project authentication settings were preserved.

## Crossing Paths browser check

Checked the updated production build locally: multiple initial approaches, flyby/impact distinctions, closest-pass markers and altitude/time estimates, observed outbound reassessment, radar focus, a precision launch against a curved approach, ammunition use, and new contacts after disruption. The map remained responsive with ten simultaneous tracks, with no application console errors observed. Optional procedural sound is implemented; perceptual audio quality is not verified by the browser's visual checks.

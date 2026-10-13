# First playable verification

## Automated

`pnpm test`: 14 tests passed.

Covered: seven independent sensors, planet occlusion, orbital movement, stale observations, uncertainty growth, frame-cadence determinism, pause/resume, isolated radar tasking, hidden-state boundaries, ammunition/cooldown, observation forecasts, complete-watch termination, successful early deflection with unresolved engagement assessment, precision disruption and new fragment contacts, and finite estimates throughout the watch.

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

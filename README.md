# Velocity Drive - 3D Driving Game

An endless 3D driving game built with **Three.js** and **Vite**. Drive a sports car down a procedurally generated highway through changing environments (highway, city, desert, mountain), dodge AI traffic, collect coins, hit checkpoints, and upgrade your car in the garage.

Everything is procedural (geometry, audio, effects), so there are **no binary assets** and the game runs fully offline after install.

## Quick start

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build into dist/
```

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Steer | A/D or Arrows | Left stick | On-screen arrows |
| Accelerate | W / Up | RT | Up button |
| Brake | S / Down | LT | B button |
| Nitro | Shift | A button | N button |
| Handbrake (drift) | Space | X button | - |
| Toggle camera | C | Y button | - |
| Pause | Esc / P | Start | - |

## Features

- Endless procedural highway with 4 rotating environment themes
- Arcade vehicle physics: speed-sensitive steering, drifting, nitro with FOV kick
- Third-person chase camera and cockpit camera
- AI traffic with overtake tracking and collision crashes
- Coins, fuel pickups, checkpoints with rewards
- Day/night cycle, sunset lighting, dynamic weather (rain, fog)
- Particle systems: tire smoke, crash sparks, rain
- Procedural Web Audio: engine pitch tied to speed, tire screech, wind, crash and coin SFX
- HUD: speedometer, minimap, timer, health/fuel/nitro bars, mission text
- Garage: paint colors, wheel styles, engine/handling/nitro upgrades (paid with coins)
- Local save: progress, garage, settings and a top-5 leaderboard (localStorage)
- Quality presets (low/medium/high), bloom post-processing toggle, mobile-friendly

## Architecture

```
src/
  main.js                  Boot sequence + loading screen
  core/
    Game.js                Game state machine, run loop, scoring, crash/fuel logic
    InputManager.js        Keyboard + touch + gamepad, merged into one input state
    AudioManager.js        Procedural Web Audio (engine, screech, wind, SFX)
    SaveManager.js         localStorage persistence (coins, garage, settings, leaderboard)
  vehicle/
    Car.js                 Car mesh (procedural) + arcade physics + nitro + headlights
  world/
    RoadGenerator.js       Pooled road segments, lane markings, rails, themed props
    Traffic.js             Pooled AI traffic cars, spawning, collision detection
    Pickups.js             Coin clusters + fuel cans with recycling
    Checkpoints.js         Checkpoint gates and rewards
    DayNightCycle.js       Sun/sky/fog interpolation + weather state machine
  effects/
    Particles.js           Generic particle pools + rain field
    CameraRig.js           Chase/cockpit cameras, FOV kick, screen shake, menu orbit
    PostProcessing.js      EffectComposer + UnrealBloom (toggleable)
  ui/
    HUD.js                 DOM HUD + canvas minimap
    Menus.js               All menu screens, garage, settings, pause, game over
```

### Design notes

- **Physics**: a custom arcade model (separate heading vs. travel direction with grip interpolation) is used for stable, smooth handling on all devices. The `Car` class isolates all physics, so swapping in `cannon-es` RaycastVehicle later only touches one file.
- **Asset pipeline**: all meshes are built from Three.js primitives with shared geometries/materials. To use GLTF/GLB models, replace the `_buildMesh` methods and load via `GLTFLoader` during the boot sequence in `main.js`.
- **Performance**: object pooling for segments/traffic/coins/particles, capped pixel ratio, shadow map that follows the player, and post-processing that can be disabled per quality preset.

## Roadmap ideas

Multiplayer racing, police chase mode, damage affecting handling, replay cameras, VR (WebXR), real GLTF car models and audio samples.

# Multi-Vehicle Racer

A browser and iPhone-friendly multi-vehicle game.

## Play online

Once GitHub Pages is enabled, the public game address is:

https://zarc70.github.io/Multi-Vehicle-Racer-Gdevelop-backend-/

## Controls

- Keyboard: arrow keys or WASD
- Touchscreen: on-screen controls
- Gamepad: supported

On iPhone:

1. Open the game link in Safari.
2. Turn the iPhone sideways.
3. Tap **Share**.
4. Choose **Add to Home Screen**.

The game can then launch from its own Home Screen icon and caches its files for offline play after the first successful load.

## Updating the game

For each future release, replace the web files in the repository root with the files from the newest GitHub Pages package. Keep GitHub Pages set to deploy from the `main` branch and `/ (root)`.


## v0.5.2 — Delta-style touchscreen layout
- Fixed-resolution game display centered on screen
- Black controller panels at left and right in landscape
- D-pad on the left
- A and B buttons on the right
- Start and Select centered near the top of the left panel
- Vehicle instructions centered near the top of the right panel
- Touch vibration without visual press/depression animation
- Keyboard controls retained
- A = Space
- B = Shift or Control


## v0.5.3 — iPhone rotation and touch repair
- Fixed nonresponsive iPhone touch controls
- Fixed blank canvas after rotating into landscape
- Removed stale service-worker caching during development
- Added cache-busted JavaScript loading
- Repositioned HUD entirely inside the fixed game screen
- Added repeated resize checks after orientation changes


## v0.5.4 — keyboard input repair
- Rebuilt keyboard input as an independent system
- Touch input can no longer clear or overwrite keyboard state
- Arrow keys and WASD restored
- Space restored as A / primary ability
- Shift or Control restored as B / secondary ability
- Enter or Space starts a selected vehicle from the menu
- Escape or Tab returns to the vehicle menu
- Removed gamepad polling from the input path for now

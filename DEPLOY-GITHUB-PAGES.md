# Deploy Multi-Vehicle Racer to GitHub Pages

Repository:

`zarc70/Multi-Vehicle-Racer-Gdevelop-backend-`

## Upload this release

1. Download and unzip this package.
2. Open the repository on GitHub.
3. Choose **Add file → Upload files**.
4. Drag the contents of the unzipped folder into the upload area.
5. Make sure `index.html` is at the repository root, not inside another folder.
6. Commit directly to the `main` branch.

## Enable GitHub Pages

1. Open the repository's **Settings**.
2. Choose **Pages** in the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Set:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**.

The public game address is:

`https://zarc70.github.io/Multi-Vehicle-Racer-Gdevelop-backend-/`

The first deployment may take a few minutes.

## Add it to an iPhone Home Screen

1. Open the published game in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Launch **Vehicle Racer** from the new icon.

## Update later

Upload the contents of each newer GitHub Pages-ready release over the existing repository files. Keep Pages set to `main` and `/ (root)`. The public URL stays the same.


## Important when replacing v0.5.2

Delete the old `service-worker.js` file from the repository if GitHub leaves it behind. Then reload the game once in Safari. This release automatically unregisters and clears the older cached version.


## v0.5.4 replacement note

Upload every file from this package over v0.5.3. The `game.js?v=054` query in `index.html` forces Safari and desktop browsers to request the repaired input code rather than reusing the older script.

# 忍者女孩阿丽亚蒂 · 花园世界

A static 3D platformer prototype. Arrietty is a 9 cm ninja in a moss-green garden. Three short segments can be played on their own, or back to back.

- **爬山虎攀爬** — climb Boston ivy up a 1.8 m wall. Swipe up and down to climb, tap to jump between vines.
- **花朵横跳** — hop across daisy heads and clover balls to the far stone.
- **风中狗尾草** — grab a swaying foxtail, climb higher where the wind swings farther, and jump when the gap closes.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4177 . The dev server is only for your machine. A production build is a folder of static files:

```bash
npm run build
npm run preview
```

`dist/` can be hosted anywhere. Asset URLs are relative, so it works on GitHub project pages (`/repo/`) and on a domain root.

## GitHub Pages

1. Push the repository to GitHub.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` builds `dist/` and deploys it on every push to `main`. You can also run it with **Actions → Deploy GitHub Pages → Run workflow**.

If you prefer not to use Actions, run `npm run build` and publish the `dist/` folder with any static host.

## Controls

| | Move | Jump | Climb |
| --- | --- | --- | --- |
| Touch | Drag | Hold still, then release. A short tap hops; a longer hold crouches and jumps higher | Up / down while holding ivy or a foxtail |
| Keyboard | WASD or arrows | Hold Space, then release | W / S or up / down on a vine or stem |

`R` restarts the segment. `Esc` returns to the garden. Falling sends Arrietty back to the last safe hold immediately. **重来** starts the segment over.

Direct links for testing: `?level=ivy`, `?level=flower`, `?level=foxtail`.

## Scale

Distances are meters. Arrietty’s height is one Boston ivy leaf: **0.09 m**. Props are the supplied GLBs at their authored size.

`girl.glb` was exported about **1.99 m** tall. On load she is scaled by `0.09 / measuredHeight` so she matches the leaf. Nothing else is rescaled.

She cannot stand on a dewdrop. Flower heads are small, so the hop uses clusters of daisies and clovers. The foxtail plant is about 0.60 m tall.

## Layout

```
index.html          page and HUD
src/main.ts         boot
src/game.ts         loop, camera, fail / win
src/stages/         hub, ivy, flower, foxtail
public/assets/      glb props
```

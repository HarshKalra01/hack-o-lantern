# Hack-O'-Lantern 🎃

**Pennywise: The Dilemma** — an interactive horror scrollytelling website by **Team Hack-O'-Lantern** (Harsh Kalra, Team Leader · Bhumi Aggarwal, Member) for **Spook-a-thon 2026 — Round 2** ("Transform your character's dilemma into a creative, interactive web experience").

## Concept

Every 27 years the clown under Derry wakes up hungry, and fear is the only thing that feeds him. But this cycle the town's kids aren't afraid anymore, and without their fear he is fading away. Scroll down into the storm drains while a fully procedural 3D clown watches you, then make the final call: **feed him your fear** so the monster survives (and stays alone forever), or **set him free** and let him fade, finally at peace. The camera starts on an extreme close-up of his face and pulls back as the story unfolds, until he is crouching by the drain, waiting for your answer.

## Features

- **"Enter if you dare" click gate** that unlocks audio (browsers block sound until the first click/tap)
- **Scroll-driven 3D clown (three.js)** built entirely in code, in a hunched, menacing pose: chalk-white cracked porcelain face, red nose, wide red-lipped toothy grin, mismatched glowing eyes, stitched grin, hinged jaw with needle teeth, tall battered striped top hat, a red-and-black frilled collar, a deep red/black harlequin tailcoat with mismatched buttons, gloved hands, striped stockings and curled shoes, standing in a sewer tunnel next to a storm-drain pipe
- **Camera zoom-out on scroll**: face close-up → full body in the sewer
- **Story beats**: his head tilts unnaturally, he waves, he holds out a red balloon, he crouches by the drain, and he lunges at the camera
- **Eyes and head follow your cursor** (or finger on mobile)
- **Point at him and he SCREAMS**: jaw rips open, stitches snap, eyes flare red, the camera shakes, red flash (with a cooldown)
- **3 scroll jumpscares**: he lunges at you with a scream and a full-screen flash, once each
- **Post-processing**: bloom on the glowing eyes, film grain, vignette and chromatic aberration, light shafts and floating spores
- **Original voice lines** in a creepy sing-song voice, triggered as you reach each chapter
- **Horror soundscape**: dark score loop, low drone, dripping water, a music box, random creaks and giggles; the score ducks under voices and screams; mute toggle (top-right)
- **Flashlight cursor** that reveals hidden messages on the tunnel walls
- **Floating red balloons** you can pop, plus bats, spiders, falling drips, fog and a flickering bulb
- **Easter eggs**: the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) unlocks Clown Mode and a secret; on mobile, tap the code on the tunnel wall 5 times. Clicking the glowing eyes in the tunnel 3 times also does something.
- **Two endings** with "try the other ending"
- **Smooth scrolling** (Lenis + GSAP ScrollTrigger) with a damped camera and eased animations
- Works on desktop and mobile: touch replaces hover (tap or hold on him to make him scream, drag to aim the flashlight), plus a lighter render mode on phones
- **Fan-made Pennywise model**: the site always loads the fan model `assets/models/clown.glb` (phones get the lighter `clown-mobile.glb`); a procedural clown built in code is the automatic fallback if the file can't load

## Project structure

```
Hack-O-Lantern/
├── index.html          ← page + story text (team names are in the footer, marked with a comment)
├── css/style.css
├── js/main.js          ← gate, audio, scroll beats, jumpscares, balloons, bats, flashlight, easter eggs, endings
├── js/clown3d.js       ← the procedural 3D clown + sewer scene (three.js)
├── assets/audio/*.mp3  ← voices, music, ambience, SFX
├── assets/img/         ← jumpscare.jpg, og.jpg
├── assets/models/      ← optional clown.glb + config.json (see Customize)
└── README.md
```

No build step. three.js and GSAP load from a CDN (unpkg / jsDelivr), so you need an internet connection.

## Run locally

Browsers block audio loading and ES modules from `file://`, so serve the folder with any static server:

```bash
cd Hack-O-Lantern
python -m http.server 8000      # or: npx serve .
```

Then open http://localhost:8000 and click **Enter if you dare**. Turn your sound on.

## Deploy to GitHub Pages

1. Create a new public repository on GitHub (for example `hack-o-lantern`).
2. Upload everything inside the `Hack-O-Lantern` folder to the root of the repo (so `index.html` sits at the top level). You can drag and drop the files on github.com ("Add file → Upload files") or push with git:
   ```bash
   git init
   git add .
   git commit -m "Hack-O'-Lantern: Pennywise, The Dilemma"
   git branch -M main
   git remote add origin https://github.com/<your-username>/hack-o-lantern.git
   git push -u origin main
   ```
3. In the repo go to **Settings → Pages**. Under "Build and deployment" pick **Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
4. Wait a minute. Your site will be live at `https://<your-username>.github.io/hack-o-lantern/`.

## Customize

- **Team member names:** open `index.html` and find the comment `EDIT TEAM MEMBER NAMES HERE` in the footer. Each `<li>` is one member; add or remove lines as needed.
- **The clown model:** the site always shows the fan model in `assets/models/clown.glb` (phones load the lighter `assets/models/clown-mobile.glb`). If the model file can't load, the site quietly falls back to a procedural clown built in code (chalk-white face, red nose, toothy grin, orange tufts, grey-blue puffy suit, ruff and pom-poms), so it never shows an empty stage.
  Settings live in `assets/models/config.json`:
  - `"model": "clown.glb"` turns the fan model on (`null` = procedural clown only)
  - `"rotateY": 3.14` if it faces the wrong way; `"height"` (default 8.2) if it looks too big or small

  The fan model is centred and scaled automatically, follows the cursor, keeps the scroll camera, and reacts to the scream with a pulse, a red flare and screen shake (a plain GLB has no rigged jaw, so only the procedural fallback clown's mouth opens). To use a different model, replace `clown.glb` with any GLB you have the rights to (for example a CC-BY download from Sketchfab, credited in the footer).

## Credits

**Team Hack-O'-Lantern**
- Harsh Kalra, Team Leader
- Bhumi Aggarwal, Member

Built with HTML, CSS, JavaScript,Chat Gpt Codex Luna, Tab 1.0, [three.js](https://threejs.org) and [GSAP](https://gsap.com). The fallback clown is procedural (built in code). The fan model (`assets/models/clown.glb`) is ["Pennywise+model"](https://sketchfab.com/3d-models/pennywisemodel-905da6d9d74e4d66ab8f47e2f375287b) by [ffincognito98](https://sketchfab.com/ffincognito98), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/), optimized for the web with gltf-transform (keep this credit if you keep the model); voice lines, music and sound effects are original and AI-generated. Fonts: Creepster, Nosifer, Special Elite and Cormorant Garamond (Google Fonts).

*Fan-made hackathon project. Pennywise and IT belong to their respective owners.*


## Phone performance (light build)
On phones, tablets and small screens the site switches itself to a light build so it stays smooth on mid-range Android:
- no bloom/film post-processing, no shadows, pixel ratio 1, no antialiasing, cheaper (Lambert) materials
- the lighter fan model `assets/models/clown-mobile.glb` (hair and ruff simplified, ~60k instead of ~230k triangles)
- fewer particles, bats, spiders, drips and balloons; lower-poly procedural clown parts; half-size generated textures
- native scrolling (no Lenis) with a short scroll scrub; no backdrop blur, blend modes or animated CSS filters
- the 3D scene pauses behind the gate, behind the black end sections and in background tabs, and drops to ~30 fps when nothing moves
- adaptive quality: the first 2 seconds are measured and quality steps down if it runs under 45 fps
- sounds load after you enter; the music streams instead of being decoded whole

Force a level for testing with `?q=2` (full), `?q=1` (light) or `?q=0` (lowest).


## Round 2 — Derry Incident Watch ("Welcome to Derry" curse + "Haunted Glass" hex)

The main page now has a **Derry Incident Watch** section (button at the top, or `#derry`), and the full tracker lives in `derry/` (plain HTML/CSS/JS, no build):

- `derry/index.html` — layout: town map (SVG), case reports, timeline, clue search, report form
- `derry/data.js` — all fictional locations, cases, tags and the 27-year cycle years. Add new cases/locations here.
- `derry/app.js` — rendering, the case modal, search/filters, the **pattern detector** (links cases by shared clues, same location and 27-year echoes), and the report form (saved in localStorage). Extension hooks: `DW.addCase()`, `DW.renderAll()`, `DW.openCase(id)`, `DW.links(id)`, `DW.hooks.push(fn)`.
- `derry/style.css` — Haunted Glass: frosted panels with `backdrop-filter: blur()` (plus `-webkit-`), kept on for phones, over a foggy haunted-mansion background with purple + orange accents.

Everything in Derry Incident Watch is fictional fan content made for a hackathon.

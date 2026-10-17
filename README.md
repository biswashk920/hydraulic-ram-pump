# Hydraulic Ram Pump Simulator
### 🚀 [Try the RAM Pump Now](https://biswashk920.github.io/Hydraulic-RAM-Pump/)

A browser simulator of a **hydraulic ram pump**: water runs down a drive pipe from an intake, a waste valve slams shut, the water hammer pushes a fraction of the water up a delivery pipe to a tank higher than the intake, and the rest is wasted. You can see a sectional cutaway of the pump, a system elevation view and live pressure traces. Pipes, the pump body and the air chamber **burst visibly** if their wall cannot hold the pressure.

![pumping](docs/screenshots/pumping-light.png)

## Contents
- [Quick start](#quick-start) · [Features](#features) · [How to use](#how-to-use) · [Controls](#controls) · [Bursting](#bursting)
- [Physics](#physics) · [Tests](#tests) · [Python notebook](#python-notebook) · [CSV files](#csv-files) · [Project layout](#project-layout) · [Limits](#limits-and-assumptions)

## Quick start
**Run it locally:** open `docs/index.html` in Chrome, Edge or any Chromium browser (double-click it; no install, no server). That one file is the whole app.

**Publish on GitHub Pages:** push the repo, then Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/docs`. The app appears at `https://<you>.github.io/<repo>/`.

Then press **Open supply valve**. The pump starts beating after a few seconds.

## Features
- Sectional cutaway of the pump: supply valve, waste (impulse) valve flap and spring, check valve, air chamber, with colours showing pressure head.
- System view from intake to delivery tank, with water rising in the delivery pipe at its real speed.
- Scope with body head, chamber head, drive-pipe flow and valve position.
- Every dimension editable, with **no fixed lift cap**: limits scale with your intake head (see [Limits](#limits-and-assumptions)).
- Material choice for the drive pipe, delivery pipe and the pump body/chamber (8 materials). Hoop stress is checked every step; if it exceeds the material strength the part **bursts** with a jet, debris and a failure banner.
- Live **water balance** (drawn = wasted + stored + delivered + leaked), D'Aubuisson efficiency and design checks.
- 8 example designs (5 working, 3 that burst) and an **Auto-tune** button for the waste valve.
- **CSV export** of your design, the run log and the scope trace; import a design CSV back.
- Light and dark themes, works on a phone.
- A "How to use this" section at the bottom of the page.

## How to use
1. Choose an example from the preset list, or edit parameters in the side panel.
2. Press **Open supply valve**. Use the speed buttons for faster simulation.
3. Watch the cutaway: the flap opens, water accelerates in the drive pipe, the flap slaps shut, the pressure spike lifts the check valve and some water enters the air chamber and climbs the delivery pipe.
4. Check the **Strength check** bars. Any bar over 100 % means that part will burst.
5. If the pump does not beat, press **Auto-tune** (finds a flap stroke and spring that works) or see the "If the pump stalls" tips on the page.
6. Press **Reset and repair** to restore a burst part.
7. Download the design and run data from the Export block.

## Controls
| group | what it sets |
|---|---|
| Intake | supply head `Hs` (m) |
| Drive pipe | length, diameter, wall thickness, material |
| Waste valve | seat diameter, stroke, flap mass, spring ratio |
| Check valve & chamber | check valve diameter, chamber volume, chamber diameter and wall |
| Pump body | material, body wall thickness |
| Delivery pipe | diameter, length, wall, material, lift `h`, start empty or full |
| Simulation | valve opening time, burst on/off |

## Bursting
Hoop stress is `σ = ρ·g·H·(D + t)/(2t)`, compared with the material's ultimate strength. It is evaluated for:
- the **drive pipe**, at every node along its length (the break appears where the head is highest);
- the **pump body** (body head);
- the **air chamber**;
- the **delivery pipe**.

On failure the part becomes a leak (water out through the hole, counted in the water balance) and the pump usually stops. Try the presets *Thin PVC drive pipe*, *Thin cast-iron body* and *Weak air chamber*. Untick "burst" to ignore failures.

![burst](docs/screenshots/burst-body.png)

## Physics
Elastic water hammer by the method of characteristics in the drive pipe, a pump-end boundary with supply valve, spring-loaded waste valve and check valve, a polytropic air chamber and a rigid-column delivery pipe with friction. Full equations: [docs/theory.md](docs/theory.md).

The water balance closes: the body and delivery residuals are about 1e-16 m³ and the drive pipe residual (compressibility) is under 0.01 % of intake in the default design.

## Tests
```
npm test            # 17 physics tests (node:test, no dependencies)
npm i && npx playwright install chromium
npm run test:e2e    # 11 checks in headless Chromium
npm run build       # rebuilds docs/index.html from src/ (only needed after editing src/)
```
The physics tests cover wave speed, hoop stress and burst head, Joukowsky surge, steady flow, water balance, energy, efficiency, every burst case, all material combinations and determinism. The browser test loads the page, runs the pump, checks the balance, exercises CSV export and import, the removed lift cap, all presets, reset, auto-tune, dark theme and phone width, and fails on any console error.

## Python notebook
`python/ram_pump_reference.ipynb` is an independent Python re-implementation with plots: water balance, Joukowsky and steady-flow checks, the hoop-stress chart for each material, a design study for lift, and a **cross-check against the JavaScript solver** using `python/data/*.csv` (volumes, front position and beat count agree to under 0.2 %).

```
pip install -r python/requirements.txt
jupyter notebook python/ram_pump_reference.ipynb
```
Regenerate the JavaScript reference data with `node tools/export-run.js`.

## CSV files
All exports use the columns `section,key,name,value,unit,si_value`.
- **Design**: all parameters. Can be loaded back with "Load design CSV".
- **Run log**: one row every 0.25 s of simulated time: flows, head, front position, volumes and beats.
- **Scope trace**: the high-rate pressure and flow samples shown in the scope.

Examples in [`examples/`](examples): `designs/*.json` (all presets) and `results/presets-240s.csv`. Regenerate with `npm run examples`. Note that long delivery lines (the 2 km preset) take longer than 240 s for water to arrive.

## Project layout
```
docs/index.html       THE APP: one self-contained page (served by GitHub Pages)
docs/theory.md        equations and assumptions
docs/screenshots/     images used in this README
src/                  editable sources: physics.js, app.js, views/, styles.css, page.template
tools/                build.js (src -> docs/index.html), presets report, exporters
tests/                physics.test.js, e2e.js
python/               notebook, JS reference data, requirements
examples/             preset designs (JSON) and result CSV
```
Edit `src/`, then run `npm run build` to refresh `docs/index.html`.

## Limits and assumptions
- Slider ranges are wide, and typed values are accepted up to hard limits (intake head 0.2–500 m, drive pipe 1–5000 m, lift up to 5000 m, delivery length up to 50 km). The design check chips flag a lift that is hard for the intake head and any part over its pressure rating.
- The flap closing-force model is empirical, not a CFD result; use Auto-tune when a design does not beat.
- Not modelled: fatigue, buckling, cavitation damage, unsteady friction, air entrainment, valve bounce. A burst means the hoop stress reached the ultimate strength, with no safety factor.
- It is an educational and design-exploration tool, not a substitute for a manufacturer's sizing or a pressure-vessel code.

## License
MIT, see [LICENSE](LICENSE).

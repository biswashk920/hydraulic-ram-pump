# Theory and model assumptions

All equations below are implemented in `src/physics.js` and independently re-implemented in `python/ram_pump_reference.ipynb`.

## 1. Drive pipe: elastic water hammer
Wave speed (Korteweg): `a = sqrt(K/rho) / sqrt(1 + K·D/(E·e))`, K = 2.2 GPa, E and e the pipe wall modulus and thickness.
The pipe is solved with the **method of characteristics**: N reaches, `dt = L/(N·a)`, with
`C+ : H_P = C_p − B·Q_P`, `C− : H_P = C_m + B·Q_P`, `B = a/(g·A)`.
Friction is steady Darcy-Weisbach (Swamee-Jain for Re > 2000, 64/Re below), applied as `R·Q|Q|` in the compatibility equations.

## 2. Pump body
The body head `Hb` is found by bisection from continuity at the pump end:
`Q_pipe = Q_waste + Q_check + Q_rupture`, with
- supply valve: extra loss `Kv = 0.2/φ²` (φ = valve opening, ramped over the valve time),
- waste valve: orifice `Cd = 0.65`, area = stroke-dependent annulus,
- check valve: orifice `Cd = 0.7`, passes water only when `Hb > H_chamber`,
- rupture orifice (only after the body has burst).

## 3. Waste valve (spring-loaded flap)
Mass `m`, opening force `vratio·rho·g·A·Hs` (spring preload), closing force `rho·g·Hb·A·(1 + 2.5·Aw/A)` (pressure plus flow drag), damping 8 s⁻¹, hard stops at 0 and `stroke`. The closing-force model is empirical, which is why designs can be tuned with the **Auto-tune** button.

## 4. Air chamber
Polytropic gas, `p·V^1.2 = const`, minimum gas volume 0.2 % of the initial volume. Chamber head is `Hch = p/(rho·g) − Patm/(rho·g)`.

## 5. Delivery pipe
Rigid column (the delivery line is slow compared with the drive pipe): `dQ/dt = (g·A/L_f)·(Hch − h_f − losses)`, rising front position `x`, Darcy friction, exit loss. Water arrives at the tank when the front reaches `Ld`.

## 6. Failure
Thin-wall hoop stress `σ = rho·g·H·(D + t)/(2t)` compared with the ultimate tensile strength `Su` of the selected material. Checked every step for the **drive pipe** (at every node, so the burst location is known), **pump body** (D_body = 2D), **air chamber**, and **delivery pipe**. On failure the part becomes a leak orifice and the water leaving through it is counted separately.

| material | E (GPa) | Su (MPa) |
|---|---|---|
| steel (mild) | 200 | 360 |
| ductile iron | 170 | 420 |
| grey cast iron | 100 | 200 |
| copper | 117 | 220 |
| bronze | 105 | 260 |
| aluminium casting | 70 | 200 |
| PVC-U | 3 | 50 |
| HDPE (PE100) | 0.8 | 22 |

(see `MATERIALS` in `src/physics.js` for the exact values used).

## 7. Water balance
`drawn = wasted + body leak + drive leak + stored + delivered + chamber/delivery leak`. Residuals are reported in the app and checked in the tests: body and delivery residuals are about 1e-16 m³; the pipe residual (water compressed or stretched inside the drive pipe) is below 1e-4 of the intake.

## 8. Efficiency
D'Aubuisson: `eta = V_delivered·h / (V_drive·Hs)`. The tests assert energy out never exceeds energy in.

## Not modelled
Fatigue, buckling, cavitation damage, unsteady friction, air entrainment, flap impact bounce, temperature. Hoop stress is a thin-wall estimate with no safety factor, so a "burst" means the stress reached the *ultimate* strength.

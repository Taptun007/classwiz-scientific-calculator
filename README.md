# ClassWiz Studio

An independent, responsive scientific calculator web app inspired by the observable workflow of the Casio fx‑991EX. It is not an official Casio product. The app runs as a static site, can be installed as a PWA, and works offline after its first successful visit.

## Run it

Start the included no-dependency server from this repository’s root:

```sh
node dev-server.js
```

Open `http://localhost:8000/` on the PC. To test on another device on the same Wi‑Fi, set `HOST=0.0.0.0` before starting the server, then open `http://<PC-LAN-IP>:8000/` on the phone. For install prompts, offline service-worker support, and access outside your local network, publish this repository to a static host with HTTPS. This repository includes a GitHub Pages workflow that deploys on each push to `main`. Then use the browser’s **Install app** or **Add to Home Screen** command. Browser storage is local to each device; settings, history, variables, and spreadsheet data do not sync between devices.

## Features

- Responsive touch keypad, mouse input, keyboard input, mode menu, shift/alpha indicators, editable expression and replayable history.
- Twelve workspaces: Calculate, Complex, Base‑N, Matrix, Vector, Statistics, Distribution, Spreadsheet, Table, Equation/Func, Inequality, and Ratio.
- Setup for angle units, natural/linear input display preference, number format, precision, fraction and complex result preferences, spreadsheet recalculation, and display contrast.
- A 47-entry scientific-constant catalog and unit conversion across length, area, volume, mass, velocity, pressure, energy, power, and temperature. The conversion picker includes the fx‑991EX’s documented unit pairs plus common related units.
- Settings, answer memory, variables, history, and spreadsheet data stored in browser local storage. A clear-all control resets calculator data.
- No JavaScript `eval`: arithmetic is parsed with a small expression parser. Numerical calculus uses finite differences and Simpson integration; `SOLVE`, regression, and higher-degree roots are numerical methods.

## Input

Type an expression into the green display or tap its keys. Examples: `sqrt(2)`, `sin(30)`, `log(2,8)`, `5!`, `nCr(8,3)`, and `2pi`. Use the angle indicator to choose degrees, radians, or gradians. `S↔D` converts the displayed decimal to a nearby rational fraction and back. `STO` saves the current answer to A–F or M. The keyboard supports digits, operators, parentheses, Enter, Escape, Backspace, and arrow-key history replay.

## Verification examples

Checked in the calculation engine against examples and behaviors documented in [Casio’s official fx‑991EX / fx‑570EX User’s Guide](https://support.casio.com/en/manual/004/fx-570_991EX_EN.pdf):

- The manual’s display examples: `100 ÷ 7` in Fix 3 → `14.286`; `1 ÷ 7` in Sci 5 → `1.4286 × 10⁻¹`.
- The manual’s constant example: `c₀` → `299792458`; its conversion example `5 cm → in` → approximately `1.96850394`.
- `sqrt(2)^2` → 2; `sin(30)` in degree mode → 0.5; `1/3 + 1/2` → 0.833333… and S↔D → 5/6.
- Matrix `[[1,2],[3,4]]`: determinant → −2; inverse → `[[-2,1],[1.5,−0.5]]`.
- Polynomial `x² − 5x + 6 = 0` → roots 2 and 3; linear system `2x + 3y = 5`, `x − y = 1` → x = 1.6, y = 0.6.
- Numerical derivative of `x²` at 3 → approximately 6; Simpson integral of `x²` from 0 to 1 → approximately 1/3.
- Ratio `2:3 = X:6` → 4; normal cumulative probability at 0 for μ=0, σ=1 → approximately 0.5; simple linear regression returns the expected slope and correlation.

The manual behavior reference is [Casio’s official fx‑991EX / fx‑570EX User’s Guide](https://support.casio.com/en/manual/004/fx-570_991EX_EN.pdf).

## Known differences

This is a practical browser implementation rather than a cycle-accurate emulator. Natural input is entered in a single editable text line; the input/output preference changes the mode indicator but does not draw the physical calculator’s textbook fraction templates. Arithmetic and `S↔D` use floating-point numbers, so exact radicals and symbolic π forms are not retained. Complex calculations use explicit real/imaginary fields rather than a general complex expression parser, and complex results are not retained as complex-valued `Ans` memory. The spreadsheet supports numeric expressions, cell references, common range summaries, and filling a selected range, but it is not a full spreadsheet editor. Regression and distribution calculations cover the common model families; higher-degree polynomial roots, `SOLVE`, differentiation, and integration use numerical methods. Some setup choices (including multiline font and QR version) are saved as preferences but have no separate visual output in this browser UI. Constant values use CODATA 2010 values where available; the catalog is a reference implementation and may differ from calculator firmware details. Storage is per browser/device, and there is no APK or cross-device synchronization.

# Rive Energy Kit (web)

A responsive showcase page for the `.riv` files in `RiveDemo/Resources`, built on the Rive web runtime (`@rive-app/canvas@2.43.1`, loaded from jsDelivr). There is no build step.

## Run

```bash
python3 -m http.server 5178 --directory web
```

Then open http://localhost:5178. The page has to be served over HTTP; opening `index.html` directly from disk won't load the `.riv` files.

## What's here

| Section | File(s) in `assets/` | How it's driven |
| --- | --- | --- |
| Home energy flow | `daytonight.riv` | Loops `EnergyFlow`; scrubs `DayToNight` and `SolarVisibility` both ways |
| EV charging meter | `evmeter.riv`, `evmeterv1.riv` | Data binding: `chargingStatus`, `meterPercent` |
| Usage tracker | `usagetracker-modes.riv` (`usagetracker(with_modes).riv`), `usageTracker.riv` | Data binding: `usage`, `projected`, `cap`, `tagValue`, `isLightMode` |

`assets/` holds copies of the Xcode resources. Re-copy them after re-exporting from Rive.

Note: in `daytonight.riv`, `State Machine 1` declares the `isDay` and `hasSolar` inputs, but no transitions are wired to them, so setting them has no visible effect. The page drives the timelines directly instead.

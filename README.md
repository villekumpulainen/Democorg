# Dog Walk Mischief: greybox prototype

A throwaway browser prototype that answers one question: is it fun on a phone to steer a dog on a physics leash and spend the owner's trust on mischief?

The dog is out on a walk. The owner walks up the street at a steady pace. Good behaviour earns trust, and mischief spends it for points. If trust hits zero, the owner takes the dog home early. If you reach home, you get a bonus.

Plain JavaScript modules and an HTML canvas. There is no framework, no build step and no dependencies.

## How to play

| Thing | What it does |
| --- | --- |
| Touch anywhere and drag a little | A floating joystick appears where you touch. The dog runs in the direction you drag, faster the further you drag (up to the ring's edge), with some inertia. Drag past the edge and the ring follows your finger. Let go and the dog coasts to a stop. Your finger never has to cover the dog. |
| **Tune → Controls: Stick / Follow** | Switches to the original scheme, where the dog runs toward your finger, for comparison. |
| Leash colour | Goes from white to red as tension rises. Pulling against a taut leash drains trust and slows the owner. Pull too hard for too long and the owner yanks the dog back. |
| Owner's phone icon | The owner is distracted. Mischief costs much less trust. |
| Flashing `!` | About 0.5 s of warning before the owner looks up. |
| Eye and red cone | The owner is watching. Mischief costs full trust, and starting a grab costs extra. |
| Burger, stroller sock, smelly patch | Stay inside the small ring until the meter fills. Burgers and smelly patches pull the dog's nose toward them (dashed ring). |
| "Leave it!" | The owner stops and a red circle appears around the target. Stay out of it until its countdown runs out (1.5 s) to earn a treat (+50 score, +15 trust). The smell pulls the dog in, so it takes some effort. Grabbing the target anyway costs extra trust. |
| Lampposts, benches, trash cans | The leash snags on them. The easy way is to hold the dog on the far side of a lamppost while the owner walks past. The owner then stops, fumbles with the leash (`#@!`) and lets out about 1.5 m of extra slack. While they're busy they aren't watching, so mischief is cheap. Treats sometimes sit on the grass just past a lamppost, out of normal reach: snag the owner on that post to get them. Unwind the leash yourself, or after a few seconds (see the bar under "TANGLED!") the owner lifts it over and loses some trust. |
| Joggers (purple) | Hold the leash taut across their path to trip them. |
| Squirrels (brown) | They bolt for the trees on the grass when the dog gets close. Cut them off and catch one. |
| Pigeons (grey dots) | Charge the flock to scatter it. If they burst near the owner, the owner is startled, drops their sandwich and glares at the dog: "Leave it!" Steal it for points and a chain at a big trust cost, or obey for a treat. After a few seconds they pick it back up. |
| Trash cans (green) | Ram one at speed to knock it over. Garbage spills out to grab, and any pigeons nearby scatter. |
| Chains | Havoc and mischief within 4 s of each other build a chain. Each link adds +50% score. |

## Run it locally

ES modules don't load from `file://`, so serve the folder over HTTP. Use either of these:

```sh
npm start                      # serves on http://localhost:8000 (needs Node)
python3 -m http.server 8000    # no Node needed
```

Then open http://localhost:8000.

### On a phone over the local network

1. Make sure the phone and the computer are on the same Wi-Fi.
2. Start the server as above. Both commands listen on all network interfaces.
3. Find the computer's LAN IP address:
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
   - Windows: `ipconfig`, then look for the IPv4 address
4. On the phone, open `http://<that-ip>:8000`, for example `http://192.168.1.23:8000`.
5. For a full-screen feel, add it to the home screen. Safari: Share → Add to Home Screen. Chrome: ⋮ → Add to Home screen.

If the phone can't connect, the computer's firewall is probably blocking port 8000.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` publishes the site on every push to `main`. You can also run it by hand from the Actions tab.

You only need to set this up once. In the repository on GitHub, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. The game is then served at `https://<owner>.github.io/<repo>/`.

## Tuning and debugging

- **Tune** opens a panel with a live slider for every number in `src/config.js`. Changes take effect immediately and are saved in the browser. **Copy config as JSON** copies the current values to the clipboard, so you can paste good settings back into `DEFAULTS`. **Reset** restores the defaults. **Restart walk** starts a new walk with the current settings. "Start trust" and "Walk distance" only apply from the next walk.
- **Debug** shows FPS, leash tension (smoothed and raw), yank state, rope length, how far the leash is wound around an obstacle, owner state and timer, dog speed, trust drain and gain per second, and the last few trust changes.

## Code map

The simulation code is kept separate from the browser code so the logic can be ported to Godot 4 later. Each sim module is plain data plus functions, with no DOM or canvas.

```
index.html, style.css     page shell, HUD buttons, overlays
src/config.js             all tunable numbers (DEFAULTS) + slider schema
src/main.js               fixed 60 Hz loop, pointer events, screens, panel wiring
src/input.js              control schemes (floating stick, finger follow) → dog target
src/render.js             greybox canvas drawing and camera (reads state only)
src/ui/tuning.js          tuning panel
src/ui/debug.js           debug overlay text
src/sim/game.js           one walk: step order, scoring, yank, round end
src/sim/dog.js            finger-follow steering with inertia, collisions
src/sim/leash.js          Verlet rope, tension, tangle detection
src/sim/owner.js          walking, attention cycle, speech
src/sim/trust.js          trust meter
src/sim/targets.js        target types, grab meter, nose pull, "leave it"
src/sim/critters.js       joggers, squirrels, pigeons, trash-can tipping
src/sim/world.js          street layout, obstacle spawning, collision helpers
```

### How the leash works

The leash is a Verlet rope of `leashSegments` points between the hand and the collar. Each tick:

1. Rope points integrate with heavy damping, so the rope behaves as if it weighs almost nothing.
2. A light straightening pass removes loose loops. Seen from above, a hanging leash looks nearly straight.
3. Stretch-only distance constraints and obstacle collisions run with both ends pinned. Collisions check points and segment midpoints, so the rope can't slip through a lamppost.
4. If the rope's path is now longer than the leash, the dog is pulled back along the rope by the excess. That's how a taut leash drags the dog with the owner, including around a post.

**Tension** measures how hard the player pushes the dog away from the leash while it is taut, from 0 to 1, smoothed over time. **Tangles** are measured by adding up how far the rope winds around each obstacle it touches. Past `tangleAngle` (160° by default), the owner stops.

### Interpretation choices

These are the places where the spec left room and the prototype had to pick something:

- **Dog friction 0.85** means the dog keeps 85% of its speed every 0.1 s while coasting, so it stops in about a second.
- **Nose pull** biases the dog's steering by the pull × 0.5 s. A plain force would be cancelled out by finger steering, so you have to actively steer away from a smell.
- **"Leave it"** has a 50% chance of triggering the first time the dog comes within 3 m of a target, whatever state the owner is in. The owner stops while waiting, otherwise the leash would drag the dog into the circle.
- **Starting a grab while watched** only costs trust when the player is steering. Being dragged over a target doesn't count.
- **The home bonus** is 500 plus 5 × the trust left.

## Playtest questions

1. Does pulling against the leash feel physical and readable, not floaty or random?
2. Does waiting for the owner to look away feel tense and satisfying?
3. Is choosing to obey "leave it" a real decision, or a chore?
4. Do tangles feel like a fun tool, or just a frustrating bug?
5. After a round, do I immediately want to play another?

# Taranto MGRS

Installable web app (PWA): OpenStreetMap base map opening on Taranto, MGRS grid overlay (WGS84/UTM), GPS position as a grid reference, tap-for-grid and go-to-grid.

> **Aid to navigation only – never rely on it alone.** Unofficial personal project on open data, not endorsed by any military, government or mapping organisation. Not for operational use, surveying, setting out or emergency response. Provided as is, without warranty; use at your own risk. The full instructions and limits open on first launch and from the '?' button.

## Install on Android

GPS and installation only work when the app is served over HTTPS – opening `index.html` from phone storage will show the map but not your position.

1. Put the contents of this folder on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages or your own server). No build step.
2. Open the URL in Chrome on the phone and allow location.
3. Chrome menu – 'Add to Home screen' / 'Install app'.

## Use

- **Centre** line: grid reference under the crosshair. **GPS** line: your position and its reported accuracy. Tap either line to copy.
- **GPS**: on and following (●) – drag the map to stop following (○) – tap again to re-centre – tap once more to switch off.
- **Go to grid**: full reference (`33T XE 8912 8234`) or digits only, completed with the square at the map centre. The target square is outlined. The same box also takes a place name (town, peak, any named feature): type the full name and press Go, then pick from the results. Results come from roughly 50 km around your position first (live GPS, else the last fix, else the map centre) and are listed nearest first with their distance; only if nothing is found there does the search go wider. The search area is sent as a box rounded to 0.1°, not as your exact position. Name search needs a data connection and uses Nominatim, OpenStreetMap's search service, under its [usage policy](https://operations.osmfoundation.org/policies/nominatim/): the app sends at most two requests per press of Go, never while typing, at most one per second, and the limit is shared by all users of the app. Do not add search-as-you-type or automated queries.
- **n fig**: cycles 4 / 6 / 8 / 10-figure references (1 km to 1 m).
- **WGS84 / ED50**: switches the datum of the grid and of every reference (read-outs, go-to, typed waypoints, route table). The base map, stored waypoints and distances do not move. In ED50 the grid turns blue, the datum label turns amber and copied references end in '(ED50)'.
- **Map: Street / Topo** (button under the top bar): switches the base map between the standard OpenStreetMap style and OpenTopoMap, which adds contour lines and hill shading. Topo tiles are native up to zoom 17; closer zooms are enlarged.
- **Grid**: overlay on/off. Spacing adapts to zoom from 100 km to 10 m; heavier lines mark the next interval up.
- Tap the map for a 10-figure reference and lat/long (when Route is off).
- **Route**: opens the route panel. Add waypoints by tapping the map, with '+ Centre' (the crosshair position) or '+ Grids' (a typed list of references, one per line). Drag a waypoint to move it; 'Undo' removes the last; 'Clear' needs a second tap. The table gives each leg's distance and bearing and the running total. With two or more waypoints the top bar shows total distance and, with GPS on, distance left along the route and distance off it. The route is kept on the phone between sessions.

## Limits

- Datums: WGS84 and ED50 only. ED50 uses the International 1924 ellipsoid and the geocentric translation EPSG:1133 'ED50 to WGS 84 (1)' (-87, -98, -121 m; source DMA TR8350.2), whose stated accuracy is 10 m. ED50 references are therefore capped at 8 figures and should be treated as good to about 10 m, not better. The national NTv2 grid (IGM) is more accurate and is not included. No Roma 40/Gauss-Boaga.
- No offline map. Both map styles are loaded live from their providers and need a data connection. OpenStreetMap's tile usage policy states that offline use of its tile server is not permitted and prohibits any 'download for offline' feature; OpenTopoMap's terms have not been confirmed, so it is treated the same way. The app therefore stores no map tiles – only the browser's ordinary cache applies. Without signal the app still opens and shows grid, position and route over a blank or partial map.
- Topo layer: OpenTopoMap is a volunteer-run service with no availability guarantee; contours come from SRTM satellite data (roughly 30 m ground resolution), so small terrain features and cliffs may not show. If it is down, switch back to Street.
- No Norway/Svalbard zone exceptions and no polar (UPS) areas – irrelevant for Italy.
- Route distances are straight-line legs on the WGS84 ellipsoid – no elevation, no path-following. Bearings are from **grid** north, not true or magnetic: apply your own conversion before using a compass.
- GPS accuracy is whatever the phone reports; a 10-figure read-out does not mean 1 m accuracy.
- Open data only. Nothing in the app is site-specific.

## Files

`index.html`, `app.js` (UI), `geo.js` (conversion maths), `sw.js` (keeps the app itself available without a connection; stores no map tiles), `manifest.webmanifest`, `icons/`, `vendor/` (Leaflet 1.9.4).

## Releasing a change

Change the cache version at the top of `sw.js` (`tmgrs-shell-vN`) and `APP_VERSION` in `app.js` with every release. Phones fetch a release as a complete set and reload once when it takes over; without the version change they keep the previous release. The running version is shown at the bottom of the '?' page.

## Licence

The app code is released under the MIT licence – see `LICENSE`. `vendor/` holds Leaflet 1.9.4, which is separately licensed (BSD 2-Clause) by its authors. Map tiles are not part of this repository and remain under their providers' terms (OpenStreetMap, OpenTopoMap).

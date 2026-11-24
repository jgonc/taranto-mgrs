# Taranto MGRS

Installable web app (PWA): OpenStreetMap base map opening on Taranto, MGRS grid overlay (WGS84/UTM), GPS position as a grid reference, tap-for-grid and go-to-grid.

## Install on Android

GPS and offline mode only work when the app is served over HTTPS – opening `index.html` from phone storage will show the map but not your position.

1. Put the contents of this folder on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages or your own server). No build step.
2. Open the URL in Chrome on the phone and allow location.
3. Chrome menu – 'Add to Home screen' / 'Install app'.

## Use

- **Centre** line: grid reference under the crosshair. **GPS** line: your position and its reported accuracy. Tap either line to copy.
- **GPS**: on and following (●) – drag the map to stop following (○) – tap again to re-centre – tap once more to switch off.
- **Go to grid**: full reference (`33T XE 8912 8234`) or digits only, completed with the square at the map centre. The target square is outlined.
- **n fig**: cycles 4 / 6 / 8 / 10-figure references (1 km to 1 m).
- **WGS84 / ED50**: switches the datum of the grid and of every reference (read-outs, go-to, typed waypoints, route table). The base map, stored waypoints and distances do not move. In ED50 the grid turns blue, the datum label turns amber and copied references end in '(ED50)'.
- **Grid**: overlay on/off. Spacing adapts to zoom from 100 km to 10 m; heavier lines mark the next interval up.
- Tap the map for a 10-figure reference and lat/long (when Route is off).
- **Route**: opens the route panel. Add waypoints by tapping the map, with '+ Centre' (the crosshair position) or '+ Grids' (a typed list of references, one per line). Drag a waypoint to move it; 'Undo' removes the last; 'Clear' needs a second tap. The table gives each leg's distance and bearing and the running total. With two or more waypoints the top bar shows total distance and, with GPS on, distance left along the route and distance off it. The route is kept on the phone between sessions.

## Limits

- Datums: WGS84 and ED50 only. ED50 uses the International 1924 ellipsoid and the geocentric translation EPSG:1133 'ED50 to WGS 84 (1)' (-87, -98, -121 m; source DMA TR8350.2), whose stated accuracy is 10 m. ED50 references are therefore capped at 8 figures and should be treated as good to about 10 m, not better. The national NTv2 grid (IGM) is more accurate and is not included. No Roma 40/Gauss-Boaga.
- Offline map = tiles already viewed while online (up to 4 000 tiles). Pan and zoom over the area at the zoom levels you need before going out of coverage. Bulk tile download is deliberately absent: the OpenStreetMap tile usage policy does not allow it.
- No Norway/Svalbard zone exceptions and no polar (UPS) areas – irrelevant for Italy.
- Route distances are straight-line legs on the WGS84 ellipsoid – no elevation, no path-following. Bearings are from **grid** north, not true or magnetic: apply your own conversion before using a compass.
- GPS accuracy is whatever the phone reports; a 10-figure read-out does not mean 1 m accuracy.
- Open data only. Nothing in the app is site-specific.

## Files

`index.html`, `app.js` (UI), `geo.js` (conversion maths), `sw.js` (offline cache), `manifest.webmanifest`, `icons/`, `vendor/` (Leaflet 1.9.4).

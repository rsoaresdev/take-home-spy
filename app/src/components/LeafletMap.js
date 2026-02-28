import { useRef, forwardRef, useImperativeHandle } from "react";
import { WebView } from "react-native-webview";

const getMarkerColor = (aqi) => {
  if (aqi <= 50) return "#22c55e";
  if (aqi <= 100) return "#eab308";
  if (aqi <= 150) return "#f97316";
  if (aqi <= 200) return "#ef4444";
  return "#7c2d12";
};

const buildHTML = (history, initialRegion) => {
  const center = [initialRegion.latitude, initialRegion.longitude];
  const zoom = initialRegion.latitudeDelta < 0.02 ? 15 : initialRegion.latitudeDelta < 0.1 ? 13 : initialRegion.latitudeDelta < 1 ? 10 : 6;

  const markersJS = history
    .map((item, index) => {
      const color = getMarkerColor(item.aqi_value);
      const date = new Date(item.created_at).toLocaleString("pt-PT");
      return `
        L.circleMarker([${item.latitude}, ${item.longitude}], {
          radius: 8,
          fillColor: "${color}",
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9
        }).bindPopup('<b>AQI ${item.aqi_value}</b><br>${date}<br><small>${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}</small>').addTo(map);
      `;
    })
    .join("\n");

  const polylineCoords =
    history.length > 1
      ? `L.polyline([${history.map((i) => `[${i.latitude},${i.longitude}]`).join(",")}], {color:"#475569",weight:2,dashArray:"6,4",opacity:0.7}).addTo(map);`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0f172a; }
    .leaflet-popup-content-wrapper { background: #1e293b; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1); }
    .leaflet-popup-tip { background: #1e293b; }
    .leaflet-popup-content b { color: #fff; }
    .leaflet-popup-content small { color: #94a3b8; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false })
    .setView([${center[0]}, ${center[1]}], ${zoom});

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  ${polylineCoords}
  ${markersJS}
</script>
</body>
</html>`;
};

const LeafletMap = forwardRef(function LeafletMap({ history, initialRegion, style }, ref) {
  const webViewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    animateTo: (latitude, longitude, zoom = 15) => {
      webViewRef.current?.injectJavaScript(
        `map.flyTo([${latitude}, ${longitude}], ${zoom}); true;`
      );
    },
  }));

  const html = buildHTML(history || [], initialRegion || {
    latitude: 39.5,
    longitude: -8.0,
    latitudeDelta: 5,
    longitudeDelta: 5,
  });

  return (
    <WebView
      ref={webViewRef}
      source={{ html }}
      style={[{ flex: 1, backgroundColor: "#0f172a" }, style]}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState={false}
      scrollEnabled={false}
    />
  );
});

export default LeafletMap;

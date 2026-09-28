// Copy to secrets.h (same folder) and fill in. secrets.h is gitignored; this file is committed.
// Never put a real secret in this .example file.

#pragma once

// 2.4 GHz phone hotspot the box and the laptop relayer share.
#define WIFI_SSID     "your-hotspot-ssid"
#define WIFI_PASSWORD "your-hotspot-password"

// Laptop relayer's address on that hotspot, e.g. "http://192.168.43.100:4000"
#define RELAYER_URL   "http://<laptop-ip>:4000"

// Same 32-byte hex secret as this box's entry in relayer/.env BOX_SECRETS.
// Generate with the team's own terminal (e.g. `openssl rand -hex 32`), not through Claude.
#define BOX_SECRET_HEX "0000000000000000000000000000000000000000000000000000000000000000"

#define BOX_ID "TS-BOX-01"

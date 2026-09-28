#pragma once
// Copy firmware/tampersafe_box/secrets.example.h to secrets.h (same folder,
// gitignored) and fill it in -- WIFI_SSID, WIFI_PASSWORD, RELAYER_URL,
// BOX_SECRET_HEX, BOX_ID. This file only derives the one thing the network
// task needs beyond what secrets.h already defines: the full events URL.
// Deliberately NOT redefining RELAYER_URL itself here (secrets.example.h
// already owns that name).
#include "secrets.h"

// String-literal concatenation: RELAYER_URL expands to a quoted string, so
// this becomes one literal at compile time, e.g.
// "http://192.168.43.100:4000" "/api/device/events".
#define RELAYER_EVENTS_URL RELAYER_URL "/api/device/events"

#include "box_context.h"
#include "protocol.h" // GENESIS_HEAD

BoxContext ctx;

const char *boxStateName(BoxState s) {
  switch (s) {
    case BoxState::BOOT: return "BOOT";
    case BoxState::IDLE: return "IDLE";
    case BoxState::ARMING: return "ARMING";
    case BoxState::SEALED: return "SEALED";
    case BoxState::TAMPERED: return "TAMPERED";
    case BoxState::OPEN_AUTHORIZED: return "OPEN_AUTHORIZED";
  }
  return "BOOT";
}

BoxState boxStateFromName(const String &name) {
  if (name == "IDLE") return BoxState::IDLE;
  if (name == "ARMING") return BoxState::ARMING;
  if (name == "SEALED") return BoxState::SEALED;
  if (name == "TAMPERED") return BoxState::TAMPERED;
  if (name == "OPEN_AUTHORIZED") return BoxState::OPEN_AUTHORIZED;
  return BoxState::BOOT; // unknown/empty (first-ever boot, no NVS entry yet)
}

#include "events.h"
#include "box_context.h"
#include "protocol.h"
#include "nvs_store.h"
#include "network_task.h"
#include "config.h" // BOX_ID

#include <string.h>

void emitEvent(const char *type, uint16_t code, const char *cmdId) {
  ctx.seq += 1;
  ctx.ts = networkCurrentUnixTime(); // 0 until NTP has synced, per §9.1

  CanonFields f;
  f.box_id = BOX_ID;
  f.seq = ctx.seq;
  f.ts = ctx.ts;
  f.type = type;
  f.state = boxStateName(ctx.state);
  f.order_id = ctx.orderId;
  f.lat_e6 = ctx.lat_e6;
  f.lon_e6 = ctx.lon_e6;
  f.fix = ctx.fix;
  f.dist_mm = ctx.distMm;
  f.lid = ctx.lid;
  f.accel_mg = ctx.accelMg;
  f.tilt_deg = ctx.tiltDeg;
  f.lock = ctx.lock;
  f.batt_mv = ctx.battMv;
  f.code = code;
  f.cmd_id = cmdId;

  char canon[CANON_BUF_LEN];
  buildCanon(f, canon, sizeof(canon));

  char newHead[65];
  computeHead(ctx.head, canon, newHead);

  // Persist BEFORE handing to the network task -- §8: "Write seq and head
  // on every event generated." This is the same latch-before-report
  // discipline as the state write, applied to the chain tail itself: if
  // the box reboots between here and the network task actually POSTing,
  // the next boot resumes the chain from the right place instead of
  // replaying or skipping seq numbers.
  nvsSaveSeq(ctx.seq);
  nvsSaveHead(String(newHead));
  strlcpy(ctx.head, newHead, sizeof(ctx.head));

  RingEvent ev{};
  ev.seq = f.seq;
  ev.ts = f.ts;
  strlcpy(ev.type, f.type, sizeof(ev.type));
  strlcpy(ev.state, f.state, sizeof(ev.state));
  ev.order_id = f.order_id;
  ev.lat_e6 = f.lat_e6;
  ev.lon_e6 = f.lon_e6;
  ev.fix = f.fix;
  ev.dist_mm = f.dist_mm;
  ev.lid = f.lid;
  ev.accel_mg = f.accel_mg;
  ev.tilt_deg = f.tilt_deg;
  ev.lock = f.lock;
  ev.batt_mv = f.batt_mv;
  ev.code = f.code;
  strlcpy(ev.cmd_id, f.cmd_id, sizeof(ev.cmd_id));
  strlcpy(ev.head, newHead, sizeof(ev.head));

  networkEnqueueEvent(ev);

  bool priority = (strcmp(type, "TAMPER") == 0) || (strcmp(type, "SEALED") == 0) || (strcmp(type, "UNLOCKED") == 0);
  if (priority) networkNotifyPriority();
}

void emitAlertEvent(uint16_t code) {
  emitEvent("ALERT", code, "");
}

// Server-Sent Events hub for GET /api/stream. ARCHITECTURE.md §9.3: events
// are "telemetry", "tx" (submitted/confirmed/failed + explorer URL),
// "alert", and "order".
import type { Response } from "express";

export type SseEventName = "telemetry" | "tx" | "alert" | "order";

export class SseHub {
  private clients = new Set<Response>();

  add(res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": connected\n\n");
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  emit(event: SseEventName, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) {
      res.write(payload);
    }
  }
}

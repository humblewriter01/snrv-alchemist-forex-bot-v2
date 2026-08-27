import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getSettingsByScheduleTaskUid: vi.fn() }));
const scanMocks = vi.hoisted(() => ({ runWatchlistScan: vi.fn() }));
const sdkMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./scan-service", () => scanMocks);
vi.mock("./_core/sdk", () => ({ sdk: sdkMocks }));

import { handleScheduledScan } from "./scheduled-scan";

function response() {
  const result = { status: vi.fn(), json: vi.fn() };
  result.status.mockReturnValue(result);
  return result;
}

describe("scheduled scan callback", () => {
  it("rejects a request without the managed cron identity", async () => {
    sdkMocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await handleScheduledScan({} as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("runs the scan only for the owner linked to the managed task", async () => {
    sdkMocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    dbMocks.getSettingsByScheduleTaskUid.mockResolvedValue({ ownerOpenId: "owner-1" });
    scanMocks.runWatchlistScan.mockResolvedValue({ processed: 2, qualified: 1, errors: [], skipped: null });
    const res = response();
    await handleScheduledScan({} as never, res as never);
    expect(dbMocks.getSettingsByScheduleTaskUid).toHaveBeenCalledWith("task-1");
    expect(scanMocks.runWatchlistScan).toHaveBeenCalledWith("owner-1");
    expect(res.json).toHaveBeenCalledWith({ ok: true, processed: 2, qualified: 1, errors: [], skipped: null });
  });
});

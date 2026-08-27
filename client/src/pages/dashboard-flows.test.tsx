import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ analyze: vi.fn(), updateSettings: vi.fn(), historyCalls: [] as unknown[], analyzeOptions: null as { onError?: (error: { message: string }) => void } | null, toastError: vi.fn() }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: state.toastError } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ signal: { overview: { invalidate: vi.fn() }, history: { invalidate: vi.fn() }, settings: { invalidate: vi.fn() } } }),
    signal: {
      overview: { useQuery: () => ({ data: { settings: { watchlist: ["XAU/USD", "EUR/USD"], defaultTimeframe: "1h", snrvEnabled: true, smcEnabled: true }, stats: { total: 0, today: 0, qualified: 0 }, recent: [], service: { marketDataConfigured: true, telegramConfigured: true, optionalAiConfigured: false, scanStatus: "idle", lastScanAt: null, lastError: null }, canManage: true }, isLoading: false }) },
      analyze: { useMutation: (options: typeof state.analyzeOptions) => { state.analyzeOptions = options; return { mutate: state.analyze, isPending: false }; } },
      history: { useQuery: (input: unknown) => { state.historyCalls.push(input); return { data: [], isLoading: false }; } },
      settings: { useQuery: () => ({ data: { watchlist: ["XAU/USD", "EUR/USD"], defaultTimeframe: "1h", snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05, telegramEnabled: false, openRouterEnabled: false, scanEnabled: false, scanCron: "0 */15 * * * *" }, isLoading: false }) },
      updateSettings: { useMutation: () => ({ mutate: state.updateSettings, isPending: false }) },
      configureScanSchedule: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import History from "./History";
import Home from "./Home";
import Settings from "./Settings";

describe("authenticated dashboard flows", () => {
  beforeEach(() => { state.analyze.mockClear(); state.updateSettings.mockClear(); state.toastError.mockClear(); state.historyCalls.length = 0; state.analyzeOptions = null; });

  it("submits the selected market and timeframe for manual signal-only analysis", () => {
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "EUR/USD" } });
    fireEvent.change(screen.getByLabelText("Timeframe"), { target: { value: "4h" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(state.analyze).toHaveBeenCalledWith({ symbol: "EUR/USD", timeframe: "4h" });
  });

  it("surfaces clear missing-key and rate-limit errors from live market analysis", () => {
    render(<Home />);
    state.analyzeOptions?.onError?.({ message: "Twelve Data is not configured. Add the server-side API key in Settings." });
    state.analyzeOptions?.onError?.({ message: "Twelve Data rate limit reached. The scan has been paused for this run." });
    expect(state.toastError).toHaveBeenNthCalledWith(1, "Twelve Data is not configured. Add the server-side API key in Settings.");
    expect(state.toastError).toHaveBeenNthCalledWith(2, "Twelve Data rate limit reached. The scan has been paused for this run.");
  });

  it("passes history filters through the authenticated data query", () => {
    render(<History />);
    fireEvent.change(screen.getByLabelText("Filter by asset"), { target: { value: "EUR/USD" } });
    fireEvent.change(screen.getByLabelText("Filter by direction"), { target: { value: "BUY" } });
    expect(state.historyCalls.at(-1)).toEqual({ symbol: "EUR/USD", direction: "BUY" });
  });

  it("serializes the owner watchlist and model controls when saving settings", () => {
    render(<Settings />);
    fireEvent.change(screen.getByPlaceholderText("XAU/USD, BTC/USD, EUR/USD"), { target: { value: "XAUUSD, EURUSD, XAUUSD" } });
    fireEvent.click(screen.getByRole("button", { name: "Save control room" }));
    expect(state.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ watchlist: ["XAUUSD", "EURUSD"], minSignalScore: 3, snrvEnabled: true, smcEnabled: true }));
  });
});

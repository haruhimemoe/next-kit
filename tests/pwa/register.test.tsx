/**
 * @file tests/pwa/register.test.tsx
 * @desc ServiceWorkerRegister: registers /sw.js at the root once the page has loaded, waits for
 *       load when it hasn't, does nothing when switched off or unsupported, and swallows a failed
 *       registration.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegister } from "../../src/pwa/index.js";

const register = vi.fn(async () => ({}));
const stub = () =>
  Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

afterEach(() => {
  register.mockClear();
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
});

describe("ServiceWorkerRegister", () => {
  it("registers at the root once loaded, and renders nothing", () => {
    stub();
    const { container } = render(<ServiceWorkerRegister enabled />);
    expect(container.innerHTML).toBe("");
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("waits for load, and stops waiting when unmounted", () => {
    stub();
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const { unmount } = render(<ServiceWorkerRegister enabled src="/worker.js" />);
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/worker.js", { scope: "/" });
    register.mockClear();
    unmount();
    window.dispatchEvent(new Event("load"));
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when off (the default outside production) or unsupported", () => {
    stub();
    render(<ServiceWorkerRegister />);
    render(<ServiceWorkerRegister enabled={false} />);
    expect(register).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "serviceWorker");
    expect(() => render(<ServiceWorkerRegister enabled />)).not.toThrow();
  });

  it("swallows a failed registration", async () => {
    stub();
    register.mockRejectedValueOnce(new Error("insecure"));
    render(<ServiceWorkerRegister enabled />);
    await Promise.resolve();
    expect(register).toHaveBeenCalled();
  });
});

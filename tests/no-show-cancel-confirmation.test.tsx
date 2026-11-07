import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { NoShowModal } from "@/components/dashboard/CalendarActionModals";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("BC-F06 no-show reversal confirmation describes cancellation instead of starting a timer", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const confirm = vi.fn();
  try {
    await act(async () =>
      root.render(
        createElement(NoShowModal, {
          isOpen: true,
          mode: "cancel",
          onClose: () => {},
          onConfirm: confirm,
        }),
      ),
    );
    expect(host.textContent).toContain("Cancel this no-show?");
    expect(host.textContent).toContain("reverse the no-show and cancel any outstanding fee");
    expect(host.textContent).not.toContain("Start No-show timer?");
    expect(host.querySelector("textarea")).toBeNull();
    await act(async () =>
      Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Yes")!.click(),
    );
    expect(confirm).toHaveBeenCalledWith({ reason: "Customer did not attend", internalNote: undefined });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

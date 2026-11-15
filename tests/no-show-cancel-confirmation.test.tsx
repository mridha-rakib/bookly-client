import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CancelBookingModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";

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
    expect(host.textContent).toContain("cancel the no-show and any outstanding fee");
    expect(host.textContent).not.toContain("return to its normal booking status");
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

it.each(["cancel", "no-show", "waive"] as const)("disables %s confirmation while its mutation is pending", async (kind) => {
  const host = document.createElement("div"), root = createRoot(host), confirm = vi.fn();
  try {
    await act(async () => root.render(kind === "cancel"
      ? createElement(CancelBookingModal, { isOpen: true, isPending: true, onClose: () => {}, onConfirm: confirm })
      : kind === "no-show"
        ? createElement(NoShowModal, { isOpen: true, isPending: true, onClose: () => {}, onConfirm: confirm })
        : createElement(WaiveChargeModal, { isOpen: true, isPending: true, onClose: () => {}, onConfirm: confirm })));
    const yes = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.trim() === "Yes")!;
    expect(yes.disabled).toBe(true);
    await act(async () => yes.click()); expect(confirm).not.toHaveBeenCalled();
    if (kind === "cancel") expect(host.querySelector("textarea")).toBeNull();
    if (kind === "no-show") expect(host.textContent).toContain("Any applicable fee");
  } finally { await act(async () => root.unmount()); }
});

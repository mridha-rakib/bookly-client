import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SuperAdminSettings from "@/components/super-admin/settings/SuperAdminSettings";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { user: {}, profile: {} } }), useChangeMyPasswordMutation: () => ({}), useUpdateMyProfileMutation: () => ({}) }));
vi.mock("@/lib/superAdminSettings/hooks", () => ({ usePlatformSettingsQuery: () => ({ data: { editable: { maxServicesPerBooking: 3, structuralMaxServicesPerBooking: 10, noShowCategoryWindows: [] } } }), useUpdatePlatformSettingsMutation: () => ({ mutate, isPending: false }) }));
vi.mock("@/components/super-admin/settings/AdminAccountSettings", () => ({ default: () => null }));
vi.mock("@/components/super-admin/settings/PlatformConfigurationSettings", () => ({ default: (props: { startEditingMaxServices: () => void; handleSaveMaxServices: () => void }) => <><button onClick={props.startEditingMaxServices}>Edit</button><button onClick={props.handleSaveMaxServices}>Save</button></> }));

it("suppresses duplicate settings saves until the request settles", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminSettings />));
    const buttons = host.querySelectorAll("button");
    act(() => buttons[0].click());
    act(() => { buttons[1].click(); buttons[1].click(); });
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate.mock.calls[0][0]).toEqual({ maxServicesPerBooking: 3 });
    act(() => mutate.mock.calls[0][1].onSettled());
    act(() => buttons[1].click());
    expect(mutate).toHaveBeenCalledTimes(2);
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CompleteModal } from "@/components/dashboard/CalendarActionModals";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
it("BC-F06 closed completion state cannot preselect another amount or leak a prior booking answer",async()=>{
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);const confirm=vi.fn();
 const render=async(open:boolean,balance?:number)=>{await act(async()=>root.render(createElement(CompleteModal,{isOpen:open,onClose:()=>{},onConfirm:confirm,defaultBalanceDueCents:balance})));};
 try {
  await render(false);await render(true,9000);
  expect(host.textContent).toContain("Yes - customer paid €90.00 at venue");
  expect(host.querySelector('input[type=number]')).toBeNull();
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Yes')!.click());
  expect(confirm).toHaveBeenLastCalledWith({settlement:"FULL",note:undefined});
  await render(false,9000);await render(true,18000);
  expect(host.textContent).toContain("Yes - customer paid €180.00 at venue");
 } finally {await act(async()=>root.unmount());host.remove();}
});

import React from "react";
export default function Link({ children, ...props }: React.PropsWithChildren<{ href: string; className?: string }>) {
  return <a {...props}>{children}</a>;
}

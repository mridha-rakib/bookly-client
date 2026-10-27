import React from "react";
export default function Image(input: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) {
  const props = { ...input };
  delete props.fill; delete props.priority; delete props.unoptimized;
  // Match Next's fill positioning while serving only local public assets in the harness.
  return <img {...props} alt={input.alt ?? ""} style={input.fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...input.style } : input.style} />;
}

import { redirect } from "next/navigation";

/**
 * Legacy compatibility shim. The blog now uses slug-based canonical URLs (`/blog/[slug]`); the
 * old `/blog/view?id=post-N` links pointed at mock ids that no longer exist. Anything landing
 * here is sent back to the blog index.
 */
export default function LegacyBlogViewPage() {
  redirect("/blog");
}

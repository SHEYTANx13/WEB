import "./template.css";

/*
 * BLOG ROUTE SETTLE (v2.5).
 *
 * Next.js re-runs templates on every navigation inside the blog route
 * tree, so this wrapper gives every incoming article/index page one
 * quiet opacity settle instead of an abrupt visual replacement. The
 * animation is opacity-only (compositor-friendly), runs on arrival —
 * it never delays navigation — and all travel motion is left to the
 * per-element reveal system. Reduced motion disables it entirely.
 *
 * The observer that reveals `data-reveal` elements lives in the blog
 * layout and persists across navigations; this template adds no
 * JavaScript at all.
 */

export default function BlogTemplate({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="blog-route-settle">
      {children}
    </div>
  );
}

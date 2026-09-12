import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

// Canonical origin. Declared once here rather than repeated in every Helmet
// block — a typo in one of those was silently telling Google that two
// different pages were the same page.
export const SITE_URL = 'https://ezwonders.com';

// Routes that are genuinely public, indexable content.
//
// Everything else is either gated (a crawler only ever sees a sign-in form),
// private (per-student codes), or a utility page — so those are marked
// noindex instead of being pointed at a canonical.
const INDEXABLE_ROUTES = new Set(['/', '/teacher-onboarding']);

// Normalises a pathname to the values in INDEXABLE_ROUTES: drops a trailing
// slash (but keeps "/") and the query string, so /teacher-onboarding/ and
// /teacher-onboarding?x=1 are treated as the same route.
function normalizePath(pathname) {
  if (!pathname) return '/';
  const withoutQuery = pathname.split('?')[0].split('#')[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

// Rendered once, inside the router. Sets the per-route canonical and robots
// tags, so a public route like /teacher-onboarding stops declaring itself a
// duplicate of the homepage.
//
// NOTE: this is the runtime (JS-executed) value. The static `canonical` in
// index.html remains the correct answer for the pre-hydration shell, which is
// always the root route's markup — see the comment there. A crawler that does
// not execute JavaScript will still see the root canonical for every URL,
// which is the known limitation of shipping an SPA without prerendering.
export default function RouteSeo() {
  const { pathname } = useLocation();
  const path = normalizePath(pathname);
  const indexable = INDEXABLE_ROUTES.has(path);

  return (
    <Helmet>
      <link rel="canonical" href={`${SITE_URL}${path === '/' ? '/' : path}`} />
      <meta
        name="robots"
        content={
          indexable
            ? 'index,follow,max-image-preview:large,max-snippet:-1'
            : 'noindex,follow'
        }
      />
    </Helmet>
  );
}

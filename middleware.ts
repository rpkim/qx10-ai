import { NextResponse, type NextRequest } from 'next/server';

const AUTH_SESSION_COOKIE = 'qx10_session';

/**
 * Paths that should always be reachable without a sign-in session.
 * Match by exact path or prefix (`endsWith('/')` semantics on the prefix list).
 */
const PUBLIC_EXACT = new Set<string>([
  '/login',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/auth/',
  '/demo',
  '/service/introduce',
  '/legal/',
  '/assets/',
  '/fonts/',
  '/images/',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/')
  );
}

function isStaticAsset(pathname: string): boolean {
  // Ignore typical static asset extensions (Next handles `_next/static` already,
  // but some apps also serve files under `/public`).
  return /\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|mjs|map|txt|woff2?|ttf|eot|otf)$/i.test(
    pathname
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (process.env.AUTH_DISABLED === 'true') return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();
  if (isStaticAsset(pathname)) return NextResponse.next();

  const hasSession = req.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (hasSession) return NextResponse.next();

  // For API routes, return 401 instead of an HTML redirect so fetch callers
  // can react cleanly.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', pathname + (search || ''));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals; middleware itself handles fine-grained allowlisting.
  matcher: ['/((?!_next/static|_next/image|_next/data).*)'],
};

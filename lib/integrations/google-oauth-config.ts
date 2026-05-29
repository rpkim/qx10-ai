export function assertGoogleClientConfigured(): void {
  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }
}

export function assertAppUrlConfigured(): void {
  if (!process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for Google OAuth');
  }
}

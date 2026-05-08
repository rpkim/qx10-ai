/**
 * Detect the W3C / IAB Global Privacy Control signal from a request.
 *
 * The browser sets `Sec-GPC: 1` on every outbound request when the user has
 * enabled GPC. Per California regulations (5 CCR §7025), a business must
 * treat this signal as a valid opt-out request for the sale and sharing of
 * personal information.
 *
 * Qx10.lol does not sell or share personal information either way, so the
 * practical effect of GPC on this Service is limited to confirming our
 * existing posture. This helper exists so any future code that wires up
 * sale/share-like behavior can short-circuit on it.
 */
export function isGpcOptOut(req: { headers: Headers }): boolean {
  return req.headers.get('sec-gpc') === '1';
}

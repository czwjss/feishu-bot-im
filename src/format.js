/**
 * Shared token/context formatting.
 *
 * One implementation for panels and menu statistics so the same value never
 * renders with two different units or precisions.
 */

/** 231 tok / 9.5Ki tok / 1.2Mi tok; `withUnit:false` drops the trailing ` tok`. */
export function formatTokens(value, { withUnit = true } = {}) {
  const amount = Number.isFinite(value) && value > 0 ? value : 0;
  let text;
  if (amount < 1024) text = `${amount}`;
  else if (amount < 1024 * 1024) text = `${(amount / 1024).toFixed(1)}Ki`;
  else text = `${(amount / (1024 * 1024)).toFixed(1)}Mi`;
  return withUnit ? `${text} tok` : text;
}

/** Compact form used where the unit is implied by the surrounding label. */
export function formatCompactTokens(value) {
  return formatTokens(value, { withUnit: false });
}

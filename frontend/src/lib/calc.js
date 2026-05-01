export function calcLog(le1, l, g1, g2) {
  const n = (v) => (Number.isFinite(+v) ? +v : 0);
  const a = n(le1), b = n(l), c = n(g1), d = n(g2);
  const cbm1 = (a * c * c) / 16000000;
  const cbm2 = (b * d * d) / 16000000;
  return {
    cbm1,
    cbm2,
    cft1: cbm1 * 35.315,
    cft2: cbm2 * 35.315,
  };
}

export const fmt = (n, d = 3) => {
  if (!Number.isFinite(+n)) return "0.000";
  return (+n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

export const fmtInt = (n) => {
  if (!Number.isFinite(+n)) return "0";
  return Math.round(+n).toLocaleString("en-US");
};

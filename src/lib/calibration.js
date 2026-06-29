import intcal20Raw from '../data/calibration/intcal20.csv?raw';
import marine20Raw from '../data/calibration/marine20.csv?raw';
import shcal20Raw from '../data/calibration/shcal20.csv?raw';

function parseCurve(raw, id, label, citation) {
  const rows = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [calBp, radiocarbonAge, sigma, delta14c, deltaSigma] = line.split(',').map(Number);
      return { calBp, radiocarbonAge, sigma, delta14c, deltaSigma };
    })
    .filter(row => Number.isFinite(row.calBp) && Number.isFinite(row.radiocarbonAge))
    .sort((a, b) => a.calBp - b.calBp);

  return {
    id,
    label,
    citation,
    rows,
    minCalBp: rows[0]?.calBp ?? 0,
    maxCalBp: rows.length ? rows[rows.length - 1].calBp : 0,
  };
}

export const calibrationCurves = {
  intcal20: parseCurve(
    intcal20Raw,
    'intcal20',
    'IntCal20 Northern Hemisphere atmospheric curve',
    'Reimer et al. 2020. The IntCal20 Northern Hemisphere radiocarbon age calibration curve (0-55 cal kBP). Radiocarbon 62. doi:10.1017/RDC.2020.41.',
  ),
  shcal20: parseCurve(
    shcal20Raw,
    'shcal20',
    'SHCal20 Southern Hemisphere atmospheric curve',
    'Hogg et al. 2020. SHCal20 Southern Hemisphere calibration, 0-55,000 years cal BP. Radiocarbon 62. doi:10.1017/RDC.2020.59.',
  ),
  marine20: parseCurve(
    marine20Raw,
    'marine20',
    'Marine20 marine radiocarbon calibration curve',
    'Heaton et al. 2020. Marine20-the marine radiocarbon age calibration curve (0-55,000 cal BP). Radiocarbon 62. doi:10.1017/RDC.2020.68.',
  ),
};

export const calibrationCurveSummaries = Object.values(calibrationCurves).map(curve => ({
  id: curve.id,
  label: curve.label,
  citation: curve.citation,
  rows: curve.rows.length,
  minCalBp: curve.minCalBp,
  maxCalBp: curve.maxCalBp,
}));

export function calendarYearToCalBp(year) {
  return 1950 - Number(year);
}

export function calBpToCalendarYear(calBp) {
  return 1950 - Number(calBp);
}

function interpolateCurve(curve, calBp) {
  const rows = curve.rows;
  if (!rows.length) return null;
  const clamped = Math.max(curve.minCalBp, Math.min(curve.maxCalBp, calBp));
  let low = 0;
  let high = rows.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (rows[mid].calBp <= clamped) low = mid;
    else high = mid;
  }
  const a = rows[low];
  const b = rows[high] || a;
  const ratio = b.calBp === a.calBp ? 0 : (clamped - a.calBp) / (b.calBp - a.calBp);
  return {
    calBp: clamped,
    calendarYear: calBpToCalendarYear(clamped),
    radiocarbonAge: a.radiocarbonAge + (b.radiocarbonAge - a.radiocarbonAge) * ratio,
    sigma: a.sigma + (b.sigma - a.sigma) * ratio,
    delta14c: a.delta14c + (b.delta14c - a.delta14c) * ratio,
    deltaSigma: a.deltaSigma + (b.deltaSigma - a.deltaSigma) * ratio,
  };
}

export function chooseCalibrationCurve(record = {}) {
  const text = [
    record.material,
    record.taxon,
    record.artifacts,
    record.association,
    record.comments,
    record.region,
    record.siteName,
  ].join(' ').toLowerCase();

  if (/\b(marine|shell|coral|mollusc|fish|otolith|foraminifera)\b/.test(text)) {
    return calibrationCurves.marine20;
  }

  if (/\b(australia|new zealand|tasmania|chile|argentina|patagonia|south africa|southern hemisphere)\b/.test(text)) {
    return calibrationCurves.shcal20;
  }

  return calibrationCurves.intcal20;
}

export function calibrateRadiocarbonSample(record, calendarYear) {
  const curve = chooseCalibrationCurve(record);
  const curvePoint = interpolateCurve(curve, calendarYearToCalBp(calendarYear));
  if (!curvePoint) return null;
  const observedAge = record.normalizedAge ?? record.measuredAge;
  const observedSigma = record.normalizedSigma ?? record.measuredSigma ?? 80;
  if (!Number.isFinite(observedAge)) return null;
  const totalSigma = Math.sqrt((observedSigma ** 2) + (curvePoint.sigma ** 2));
  return {
    curveId: curve.id,
    curveLabel: curve.label,
    curveCitation: curve.citation,
    curvePoint,
    observedAge,
    observedSigma,
    totalSigma,
  };
}

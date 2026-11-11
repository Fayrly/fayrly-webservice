const LOCALE = 'id-ID';
const TIME_ZONE = 'Asia/Jakarta';

type Parts = Record<string, string>;

function partValues(date: Date, options: Intl.DateTimeFormatOptions): Parts {
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE })
    .formatToParts(date)
    .reduce<Parts>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
}

export function formatEventDate(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const p = partValues(start, {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${p['day']} ${p['month']} '${p['year']} • ${p['hour']}.${p['minute']} WIB`;
}

export function formatLongDate(startsAt: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(startsAt));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatTimeRange(startsAt: string, endsAt?: string | null): string {
  const start = partValues(new Date(startsAt), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  if (!endsAt) {
    return `${start['hour']}.${start['minute']} WIB`;
  }
  const end = partValues(new Date(endsAt), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const sameDay = wibDayNumber(new Date(startsAt)) === wibDayNumber(new Date(endsAt));
  return sameDay
    ? `${start['hour']}.${start['minute']} – ${end['hour']}.${end['minute']} WIB`
    : `${start['hour']}.${start['minute']} WIB`;
}

export function extraDays(startsAt: string, endsAt?: string | null): number {
  if (!endsAt) {
    return 0;
  }
  return Math.max(0, wibDayNumber(new Date(endsAt)) - wibDayNumber(new Date(startsAt)));
}

function wibDayNumber(date: Date): number {
  const p = partValues(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return Date.UTC(Number(p['year']), Number(p['month']) - 1, Number(p['day'])) / 86_400_000;
}

export function wibStartOfDayIso(date: Date): string {
  const p = partValues(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return new Date(Date.UTC(Number(p['year']), Number(p['month']) - 1, Number(p['day']), -7)).toISOString();
}

export function formatCompactPrice(value: number, currency = 'IDR'): string {
  if (value <= 0) {
    return 'Gratis';
  }
  const unit = currency === 'IDR' ? 'IDR' : currency;
  if (value >= 1_000_000) {
    return `${unit} ${decimal(value / 1_000_000)}JT`;
  }
  if (value >= 1_000) {
    return `${unit} ${decimal(value / 1_000)}K`;
  }
  return `${unit} ${value}`;
}

export function formatMoney(value: number, currency = 'IDR'): string {
  if (value <= 0) {
    return 'Gratis';
  }
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceRange(min: number, max: number, currency = 'IDR'): string {
  if (max <= 0 && min <= 0) {
    return 'Gratis';
  }
  if (min === max || max <= 0) {
    return formatMoney(min, currency);
  }
  if (min <= 0) {
    return `Gratis – ${formatMoney(max, currency)}`;
  }
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function decimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

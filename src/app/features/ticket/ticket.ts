import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ApiError } from '../../core/models/api-error.model';
import { EVENT_TYPE_LABEL, Event, EventType } from '../../core/models/event.model';
import { errorMessage } from '../../core/util/errors';
import { formatLongDate, formatMoney, formatNumber, formatTimeRange } from '../../core/util/format';
import { ErrorState } from '../../shared/ui/error-state/error-state';

interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  seats: boolean;
  perks: string[];
}

interface SeatSpot {
  id: string;
  occupied: boolean;
}

interface MapSection {
  id: string;
  label: string;
  path: string;
  labelX: number;
  labelY: number;
  seats: SeatSpot[];
}

interface TierZone {
  id: string;
  name: string;
  price: number;
  fill: string;
  stroke: string;
  label: string;
  sections: MapSection[];
}

interface OrderSummary {
  code: string;
  tierName: string;
  quantity: number;
  seats: string[];
  price: number;
  total: number;
  currency: string;
}

const MAX_TICKETS = 4;
const OCCUPIED_RATIO = 0.28;
const SEAT_ROWS = 3;
const SEAT_GAP = 4;

const MAP = { width: 440, height: 340, cx: 220, cy: 170 };
const ZONE_STYLES = [
  { fill: '#357662', stroke: '#24604f', label: '#ffffff' },
  { fill: '#bcead5', stroke: '#6faf98', label: '#12362d' },
];
const ZONE_BANDS = [
  { inner: 78, outer: 110 },
  { inner: 128, outer: 160 },
];
const SECTION_ANGLES = [
  { suffix: 'B', start: 35, end: 145 },
  { suffix: 'A', start: 160, end: 215 },
  { suffix: 'C', start: -35, end: 20 },
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function annularPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const point = (radius: number, angle: number): string => {
    const rad = toRadians(angle);
    return `${(cx + radius * Math.cos(rad)).toFixed(1)} ${(cy + radius * Math.sin(rad)).toFixed(1)}`;
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${point(outerRadius, startAngle)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${point(outerRadius, endAngle)}`,
    `L ${point(innerRadius, endAngle)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${point(innerRadius, startAngle)}`,
    'Z',
  ].join(' ');
}

function hashRatio(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967295;
}

@Component({
  selector: 'app-ticket',
  imports: [RouterLink, LucideAngularModule, ErrorState],
  templateUrl: './ticket.html',
})
export class TicketPage {
  private readonly eventService = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  private readonly summaryDialog = viewChild<ElementRef<HTMLDialogElement>>('summaryDialog');

  protected readonly event = signal<Event | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);

  protected readonly quantity = signal(1);
  protected readonly selectedTierId = signal('');
  protected readonly selectedSeats = signal<string[]>([]);
  protected readonly seatNotice = signal<string | null>(null);
  protected readonly order = signal<OrderSummary | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly formatMoney = formatMoney;
  protected readonly formatNumber = formatNumber;

  protected readonly typeLabel = computed(() => {
    const value = this.event();
    return value ? (EVENT_TYPE_LABEL[value.type as EventType] ?? 'Event') : '';
  });
  protected readonly dateLabel = computed(() => {
    const value = this.event();
    return value ? formatLongDate(value.starts_at) : '';
  });
  protected readonly timeLabel = computed(() => {
    const value = this.event();
    return value ? formatTimeRange(value.starts_at, value.ends_at) : '';
  });

  protected readonly tiers = computed<TicketTier[]>(() => {
    const value = this.event();
    return value ? this.buildTiers(value) : [];
  });
  protected readonly selectedTier = computed<TicketTier | null>(() => {
    const tiers = this.tiers();
    return tiers.find((tier) => tier.id === this.selectedTierId()) ?? tiers[0] ?? null;
  });

  protected readonly canBuy = computed(() => {
    const status = this.event()?.status;
    return status === 'published' || status === 'ongoing';
  });
  protected readonly maxQuantity = computed(() => {
    const capacity = this.event()?.capacity ?? 0;
    return capacity > 0 ? Math.min(MAX_TICKETS, capacity) : MAX_TICKETS;
  });
  protected readonly total = computed(() => {
    const tier = this.selectedTier();
    return tier ? tier.price * this.quantity() : 0;
  });
  protected readonly needsSeats = computed(
    () => this.selectedTier()?.seats === true && this.selectedSeats().length !== this.quantity(),
  );
  protected readonly checkoutDisabled = computed(
    () =>
      !this.event() || !this.canBuy() || (this.selectedTier()?.seats === true && this.needsSeats()),
  );
  protected readonly checkoutLabel = computed(() => {
    if (!this.canBuy()) {
      return 'Tiket belum tersedia';
    }
    if (this.selectedTier()?.seats && this.needsSeats()) {
      return 'Pilih kursi dulu';
    }
    if (!this.isAuthenticated()) {
      return 'Masuk untuk melanjutkan';
    }
    if (this.selectedTier()?.price === 0) {
      return 'Konfirmasi kehadiran';
    }
    return 'Lanjut ke pembayaran';
  });
  protected readonly selectedSeatLabel = computed(() => {
    const seats = this.selectedSeats();
    return seats.length ? seats.join(', ') : 'Belum dipilih';
  });

  protected readonly mapWidth = MAP.width;
  protected readonly mapHeight = MAP.height;
  protected readonly mapViewBox = `0 0 ${MAP.width} ${MAP.height}`;
  protected readonly zones = computed<TierZone[]>(() => {
    const value = this.event();
    if (!value) {
      return [];
    }
    return this.tiers()
      .filter((tier) => tier.seats)
      .map((tier, index) => this.buildZone(value, tier, index));
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        distinctUntilChanged(),
        tap(() => this.resetState()),
        switchMap((slug) =>
          this.eventService.get(slug).pipe(
            map((event) => ({ event, error: null as unknown })),
            catchError((error: unknown) => of({ event: null, error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ event, error }) => {
        if (event) {
          this.applyEvent(event);
          return;
        }
        this.applyError(error);
      });
  }

  protected retry(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (!slug) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.eventService.get(slug).subscribe({
      next: (event) => this.applyEvent(event),
      error: (error: unknown) => this.applyError(error),
    });
  }

  protected selectTier(id: string): void {
    if (id === this.selectedTierId()) {
      return;
    }
    this.selectedTierId.set(id);
    this.quantity.set(1);
    this.selectedSeats.set([]);
    this.seatNotice.set(null);
    this.syncSeats();
  }

  protected adjustQuantity(delta: number): void {
    const next = Math.min(this.maxQuantity(), Math.max(1, this.quantity() + delta));
    if (next === this.quantity()) {
      return;
    }
    this.quantity.set(next);
    this.syncSeats();
  }

  protected onZoneKeydown(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectTier(id);
    }
  }

  protected shuffleSeats(): void {
    if (this.selectedTier()?.seats) {
      this.syncSeats(true);
    }
  }

  private syncSeats(randomize = false): void {
    const tier = this.selectedTier();
    if (!tier?.seats) {
      this.selectedSeats.set([]);
      this.seatNotice.set(null);
      return;
    }
    const quantity = this.quantity();
    const keep = randomize ? [] : this.selectedSeats().slice(0, quantity);
    const picked = this.pickSeats(tier.id, quantity, keep, randomize);
    this.selectedSeats.set(picked);
    this.seatNotice.set(
      picked.length < quantity
        ? 'Kursi di zona ini tidak cukup untuk jumlah tiket yang dipilih.'
        : null,
    );
  }

  private pickSeats(tierId: string, count: number, keep: string[], randomize: boolean): string[] {
    const zone = this.zones().find((item) => item.id === tierId);
    if (!zone) {
      return keep.slice(0, count);
    }
    const pool = zone.sections
      .flatMap((section) => section.seats)
      .filter((seat) => !seat.occupied && !keep.includes(seat.id))
      .map((seat) => seat.id);
    if (randomize) {
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swap]] = [pool[swap], pool[index]];
      }
    }
    return [...keep, ...pool].slice(0, count);
  }

  protected checkout(): void {
    const value = this.event();
    const tier = this.selectedTier();
    if (!value || !tier || !this.canBuy()) {
      return;
    }
    if (!this.isAuthenticated()) {
      this.router.navigate(['/masuk'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (tier.seats && this.needsSeats()) {
      this.seatNotice.set('Pilih kursi sesuai jumlah tiket sebelum melanjutkan.');
      return;
    }

    this.order.set({
      code: `FRY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      tierName: tier.name,
      quantity: this.quantity(),
      seats: [...this.selectedSeats()],
      price: tier.price,
      total: tier.price * this.quantity(),
      currency: value.currency || 'IDR',
    });
    this.summaryDialog()?.nativeElement.showModal();
  }

  protected closeSummary(): void {
    this.summaryDialog()?.nativeElement.close();
  }

  private buildZone(value: Event, tier: TicketTier, index: number): TierZone {
    const style = ZONE_STYLES[index % ZONE_STYLES.length];
    const band = ZONE_BANDS[index % ZONE_BANDS.length];
    const midRadius = (band.inner + band.outer) / 2;
    const sections = SECTION_ANGLES.map((angles) => {
      const label = `${index + 1}${angles.suffix}`;
      const midAngle = toRadians((angles.start + angles.end) / 2);
      return {
        id: label,
        label,
        path: annularPath(MAP.cx, MAP.cy, band.inner, band.outer, angles.start, angles.end),
        labelX: Number((MAP.cx + midRadius * Math.cos(midAngle)).toFixed(1)),
        labelY: Number((MAP.cy + midRadius * Math.sin(midAngle) + 4.5).toFixed(1)),
        seats: this.buildSeats(value, tier, band, angles, label),
      };
    });
    return {
      id: tier.id,
      name: tier.name,
      price: tier.price,
      fill: style.fill,
      stroke: style.stroke,
      label: style.label,
      sections,
    };
  }

  private buildSeats(
    value: Event,
    tier: TicketTier,
    band: { inner: number; outer: number },
    angles: { start: number; end: number },
    label: string,
  ): SeatSpot[] {
    const seats: SeatSpot[] = [];
    const span = angles.end - angles.start;
    for (let row = 0; row < SEAT_ROWS; row += 1) {
      const radius = band.inner + ((row + 0.5) * (band.outer - band.inner)) / SEAT_ROWS;
      const count = Math.max(4, Math.floor((radius * toRadians(span)) / SEAT_GAP));
      for (let index = 0; index < count; index += 1) {
        const id = `${label}-${row + 1}${String(index + 1).padStart(2, '0')}`;
        seats.push({
          id,
          occupied: hashRatio(`${value.id}:${tier.id}:${label}:${row}:${index}`) < OCCUPIED_RATIO,
        });
      }
    }
    return seats;
  }

  private buildTiers(value: Event): TicketTier[] {
    if ((value.price_max ?? 0) <= 0) {
      return [
        {
          id: 'gratis',
          name: 'Registrasi gratis',
          description: 'Konfirmasi kehadiran tanpa biaya tiket.',
          price: 0,
          seats: false,
          perks: ['Akses ke area acara', 'Konfirmasi kehadiran digital'],
        },
      ];
    }

    if ((value.price_min ?? 0) === (value.price_max ?? 0)) {
      return [
        {
          id: 'reguler',
          name: 'Tiket reguler',
          description: 'Satu harga untuk seluruh area acara.',
          price: value.price_min,
          seats: false,
          perks: ['Akses area acara', 'E-tiket dengan kode pemesanan'],
        },
      ];
    }

    if (value.type !== 'concert') {
      return [
        {
          id: 'reguler',
          name: 'Tiket reguler',
          description: 'Akses area acara dengan harga dasar.',
          price: value.price_min,
          seats: false,
          perks: ['Akses area acara', 'E-tiket dengan kode pemesanan'],
        },
        {
          id: 'utama',
          name: 'Tiket utama',
          description: 'Akses area acara dengan harga dukungan lebih tinggi.',
          price: value.price_max,
          seats: false,
          perks: ['Akses area acara', 'E-tiket dengan kode pemesanan'],
        },
      ];
    }

    return [
      {
        id: 'cat-1',
        name: 'CAT 1',
        description: 'Area paling dekat dengan panggung.',
        price: value.price_max,
        seats: true,
        perks: ['Baris depan area panggung', 'Kursi bernomor', 'E-tiket dengan kode pemesanan'],
      },
      {
        id: 'cat-2',
        name: 'CAT 2',
        description: 'Area tengah dengan pandangan luas.',
        price: value.price_min,
        seats: true,
        perks: ['Area tengah tribun', 'Kursi bernomor', 'E-tiket dengan kode pemesanan'],
      },
    ];
  }

  private resetState(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.event.set(null);
    this.selectedTierId.set('');
    this.quantity.set(1);
    this.selectedSeats.set([]);
    this.seatNotice.set(null);
    this.order.set(null);
  }

  private applyEvent(value: Event): void {
    this.loading.set(false);
    this.event.set(value);
    const tiers = this.buildTiers(value);
    const cheapest = [...tiers].sort((a, b) => a.price - b.price)[0];
    this.selectedTierId.set(cheapest?.id ?? '');
    this.quantity.set(1);
    this.selectedSeats.set([]);
    this.seatNotice.set(null);
    if (cheapest?.seats) {
      this.syncSeats();
    }
    this.title.setTitle(`Pilih tiket — ${value.title} — Fayrly`);
  }

  private applyError(error: unknown): void {
    this.loading.set(false);
    if (error instanceof ApiError && error.status === 404) {
      this.notFound.set(true);
      return;
    }
    this.error.set(errorMessage(error));
  }
}

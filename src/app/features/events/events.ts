import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EventService } from '../../core/api/event.service';
import {
  EVENT_TYPE_LABEL,
  Event,
  EventType,
  Pagination,
} from '../../core/models/event.model';
import { errorMessage } from '../../core/util/errors';
import { wibStartOfDayIso } from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EventCard } from '../../shared/ui/event-card/event-card';
import { EventCardSkeleton } from '../../shared/ui/event-card-skeleton/event-card-skeleton';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select';

type DateRange = '' | 'today' | '7d' | '30d';

interface Filters {
  q: string;
  type: EventType | '';
  city: string;
  date: DateRange;
}

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari ke depan' },
  { value: '30d', label: '30 hari ke depan' },
];

const TYPE_OPTIONS: { value: EventType | ''; label: string }[] = [
  { value: '', label: 'Semua kategori' },
  { value: 'concert', label: EVENT_TYPE_LABEL.concert },
  { value: 'charity', label: EVENT_TYPE_LABEL.charity },
  { value: 'community', label: EVENT_TYPE_LABEL.community },
];

const PAGE_SIZE = 12;

@Component({
  selector: 'app-events',
  imports: [
    LucideAngularModule,
    EventCard,
    EventCardSkeleton,
    EmptyState,
    ErrorState,
    SelectComponent,
  ],
  templateUrl: './events.html',
})
export class EventsPage {
  private readonly eventService = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly dateOptions = DATE_OPTIONS;

  protected readonly filters = signal<Filters>({ q: '', type: '', city: '', date: '' });
  protected readonly searchText = signal('');
  protected readonly cities = signal<string[]>([]);
  protected readonly events = signal<Event[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly moreError = signal<string | null>(null);

  protected readonly total = computed(() => this.pagination()?.total ?? 0);
  protected readonly cityOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [{ value: '', label: 'Semua kota' }];
    const current = this.filters().city;
    if (current && !this.cities().includes(current)) {
      options.push({ value: current, label: current });
    }
    for (const city of this.cities()) {
      options.push({ value: city, label: city });
    }
    return options;
  });
  protected readonly hasMore = computed(() => {
    const page = this.pagination();
    return page !== null && page.page < page.total_pages;
  });
  protected readonly hasFilters = computed(() => {
    const value = this.filters();
    return Boolean(value.q || value.type || value.city || value.date);
  });

  private requestId = 0;

  constructor() {
    this.eventService.list({ pageSize: 100 }).subscribe({
      next: (response) => {
        const unique = [...new Set(response.data.map((event) => event.city).filter(Boolean))];
        this.cities.set(unique.sort((a, b) => a.localeCompare(b, 'id')));
      },
      error: () => this.cities.set([]),
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const type = params.get('type');
      const date = params.get('date');
      const next: Filters = {
        q: params.get('q') ?? '',
        type: TYPE_OPTIONS.some((option) => option.value === type) ? (type as EventType) : '',
        city: params.get('city') ?? '',
        date: DATE_OPTIONS.some((option) => option.value === date) ? (date as DateRange) : '',
      };
      this.filters.set(next);
      this.searchText.set(next.q);
      this.load(1, false);
    });
  }

  protected submitSearch(event?: globalThis.Event): void {
    event?.preventDefault();
    this.navigateWith({ q: this.searchText().trim() });
  }

  protected setType(type: EventType | ''): void {
    this.navigateWith({ type });
  }

  protected setCity(city: string): void {
    this.navigateWith({ city });
  }

  protected setDate(date: string): void {
    this.navigateWith({ date: date as DateRange });
  }

  protected reset(): void {
    this.searchText.set('');
    this.router.navigate(['/events']);
  }

  protected loadMore(): void {
    const page = this.pagination();
    if (!page || this.loadingMore()) {
      return;
    }
    this.load(page.page + 1, true);
  }

  protected retry(): void {
    this.load(1, false);
  }

  protected retryMore(): void {
    this.loadMore();
  }

  private navigateWith(partial: Partial<Filters>): void {
    const next = { ...this.filters(), ...partial };
    this.router.navigate(['/events'], {
      queryParams: {
        q: next.q || null,
        type: next.type || null,
        city: next.city || null,
        date: next.date || null,
      },
    });
  }

  private load(page: number, append: boolean): void {
    const id = ++this.requestId;
    const filters = this.filters();
    const range = this.dateRange(filters.date);

    if (append) {
      this.loadingMore.set(true);
      this.moreError.set(null);
    } else {
      this.loading.set(true);
      this.error.set(null);
      this.moreError.set(null);
    }

    this.eventService
      .list({
        q: filters.q,
        type: filters.type,
        city: filters.city,
        from: range.from,
        to: range.to,
        page,
        pageSize: PAGE_SIZE,
      })
      .subscribe({
        next: (response) => {
          if (id !== this.requestId) {
            return;
          }
          this.events.update((current) =>
            append ? mergeUnique(current, response.data) : response.data,
          );
          this.pagination.set(response.pagination);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (error: unknown) => {
          if (id !== this.requestId) {
            return;
          }
          const message = errorMessage(error);
          this.loading.set(false);
          this.loadingMore.set(false);
          if (append) {
            this.moreError.set(message);
          } else {
            this.error.set(message);
            this.events.set([]);
            this.pagination.set(null);
          }
        },
      });
  }

  private dateRange(date: DateRange): { from?: string; to?: string } {
    if (!date) {
      return {};
    }
    const days = date === 'today' ? 1 : date === '7d' ? 7 : 30;
    return {
      from: wibStartOfDayIso(new Date()),
      to: wibStartOfDayIso(new Date(Date.now() + days * 86_400_000)),
    };
  }
}

function mergeUnique(current: Event[], incoming: Event[]): Event[] {
  const seen = new Set(current.map((event) => event.id));
  return [...current, ...incoming.filter((event) => !seen.has(event.id))];
}

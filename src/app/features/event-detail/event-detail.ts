import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReviewService } from '../../core/api/review.service';
import { ApiError } from '../../core/models/api-error.model';
import { EVENT_TYPE_LABEL, Event, EventType } from '../../core/models/event.model';
import { Review, ReviewSummary } from '../../core/models/review.model';
import { errorMessage } from '../../core/util/errors';
import {
  extraDays,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPriceRange,
  formatTimeRange,
  initials,
} from '../../core/util/format';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { GoingStack } from '../../shared/ui/going-stack/going-stack';
import { ReviewCard } from '../../shared/ui/review-card/review-card';

@Component({
  selector: 'app-event-detail',
  imports: [
    RouterLink,
    NgOptimizedImage,
    LucideAngularModule,
    ErrorState,
    GoingStack,
    ReviewCard,
  ],
  templateUrl: './event-detail.html',
})
export class EventDetailPage {
  private readonly eventService = inject(EventService);
  private readonly reviewService = inject(ReviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  protected readonly auth = inject(AuthService);

  protected readonly event = signal<Event | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly expanded = signal(false);

  protected readonly reviews = signal<Review[]>([]);
  protected readonly reviewSummary = signal<ReviewSummary>({ count: 0, average: 0 });
  protected readonly reviewsLoading = signal(true);
  protected readonly reviewsError = signal<string | null>(null);
  protected readonly reviewRating = signal(5);
  protected readonly reviewBody = signal('');
  protected readonly reviewSubmitting = signal(false);
  protected readonly reviewError = signal<string | null>(null);
  protected readonly reviewSuccess = signal(false);
  protected readonly reviewStars = [1, 2, 3, 4, 5];

  protected readonly typeLabel = computed(() => {
    const event = this.event();
    return event ? (EVENT_TYPE_LABEL[event.type as EventType] ?? 'Event') : '';
  });
  protected readonly orgInitials = computed(() => initials(this.event()?.organizer_name ?? ''));
  protected readonly dateLabel = computed(() => {
    const event = this.event();
    return event ? formatLongDate(event.starts_at) : '';
  });
  protected readonly timeLabel = computed(() => {
    const event = this.event();
    return event ? formatTimeRange(event.starts_at, event.ends_at) : '';
  });
  protected readonly extraDayCount = computed(() => {
    const event = this.event();
    return event ? extraDays(event.starts_at, event.ends_at) : 0;
  });
  protected readonly priceRange = computed(() => {
    const event = this.event();
    return event ? formatPriceRange(event.price_min, event.price_max, event.currency) : '';
  });
  protected readonly isFree = computed(() => (this.event()?.price_max ?? 0) <= 0);
  protected readonly hasLongDescription = computed(
    () => (this.event()?.description.length ?? 0) > 360,
  );
  protected readonly donationPercent = computed(() => {
    const event = this.event();
    if (!event?.donation_target || event.donation_target <= 0) {
      return 0;
    }
    return Math.min(100, Math.round(((event.donation_raised ?? 0) / event.donation_target) * 100));
  });
  protected readonly canBuy = computed(() => {
    const status = this.event()?.status;
    return status === 'published' || status === 'ongoing';
  });
  protected readonly averageLabel = computed(() => {
    const summary = this.reviewSummary();
    return summary.count > 0 ? summary.average.toFixed(1).replace('.', ',') : '—';
  });
  protected readonly averageStars = computed(() => Math.round(this.reviewSummary().average));
  protected readonly contactHref = computed(() => {
    const event = this.event();
    if (!event?.contact_email) {
      return null;
    }
    const subject = encodeURIComponent(`Informasi tiket ${event.title}`);
    return `mailto:${event.contact_email}?subject=${subject}`;
  });

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.notFound.set(false);
          this.expanded.set(false);
          this.event.set(null);
          this.reviews.set([]);
          this.reviewSummary.set({ count: 0, average: 0 });
          this.reviewsLoading.set(true);
          this.reviewsError.set(null);
          this.reviewSuccess.set(false);
          this.reviewError.set(null);
        }),
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

  protected setReviewRating(value: number): void {
    if (!this.reviewSubmitting()) {
      this.reviewRating.set(value);
    }
  }

  protected onReviewBodyInput(domEvent: globalThis.Event): void {
    this.reviewBody.set((domEvent.target as HTMLTextAreaElement).value);
    this.reviewError.set(null);
  }

  protected reloadReviews(): void {
    const event = this.event();
    if (event) {
      this.loadReviews(event.slug);
    }
  }

  protected submitReview(domEvent?: globalThis.Event): void {
    domEvent?.preventDefault();
    const current = this.event();
    if (!current || this.reviewSubmitting() || !this.auth.isAuthenticated()) {
      return;
    }
    const body = this.reviewBody().trim();
    if (body.length < 10) {
      this.reviewError.set('Tulis ulasan minimal 10 karakter agar lebih bermanfaat.');
      return;
    }
    if (body.length > 2000) {
      this.reviewError.set('Ulasan maksimal 2000 karakter.');
      return;
    }

    this.reviewSubmitting.set(true);
    this.reviewError.set(null);
    this.reviewService.create(current.slug, { rating: this.reviewRating(), body }).subscribe({
      next: (review) => {
        this.reviewSubmitting.set(false);
        this.reviewSuccess.set(true);
        this.reviews.update((list) => [review, ...list].slice(0, 6));
        this.reviewSummary.update((summary) => {
          const count = summary.count + 1;
          const average = (summary.average * summary.count + review.rating) / count;
          return { count, average: Math.round(average * 10) / 10 };
        });
        this.event.update((value) =>
          value
            ? {
                ...value,
                review_count: value.review_count + 1,
                rating_avg: Number(
                  (
                    (value.rating_avg * value.review_count + review.rating) /
                    (value.review_count + 1)
                  ).toFixed(1),
                ),
              }
            : value,
        );
        this.reviewBody.set('');
        this.reviewRating.set(5);
      },
      error: (error: unknown) => {
        this.reviewSubmitting.set(false);
        if (error instanceof ApiError && error.status === 409) {
          this.reviewError.set('Kamu sudah menulis ulasan untuk event ini.');
          return;
        }
        this.reviewError.set(errorMessage(error));
      },
    });
  }

  private loadReviews(slug: string): void {
    this.reviewsLoading.set(true);
    this.reviewsError.set(null);
    this.reviewService.listForEvent(slug, 6).subscribe({
      next: (response) => {
        if (this.event()?.slug !== slug) {
          return;
        }
        this.reviews.set(response.data);
        this.reviewSummary.set(response.summary);
        this.reviewsLoading.set(false);
      },
      error: (error: unknown) => {
        if (this.event()?.slug !== slug) {
          return;
        }
        this.reviewsError.set(errorMessage(error));
        this.reviewsLoading.set(false);
      },
    });
  }

  private applyEvent(event: Event): void {
    this.loading.set(false);
    this.event.set(event);
    this.title.setTitle(`${event.title} — Fayrly`);
    this.loadReviews(event.slug);
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

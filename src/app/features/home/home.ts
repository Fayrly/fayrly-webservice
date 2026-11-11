import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EventService } from '../../core/api/event.service';
import { ReviewService } from '../../core/api/review.service';
import { EVENT_TYPE_LABEL, Event, EventQuery, EventType } from '../../core/models/event.model';
import { Review } from '../../core/models/review.model';
import { errorMessage } from '../../core/util/errors';
import { formatCompactPrice, formatEventDate, wibStartOfDayIso } from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EventCard } from '../../shared/ui/event-card/event-card';
import { EventCardSkeleton } from '../../shared/ui/event-card-skeleton/event-card-skeleton';
import { ReviewCard } from '../../shared/ui/review-card/review-card';

interface SectionState {
  loading: boolean;
  events: Event[];
  error: string | null;
}

interface Section {
  id: string;
  title: string;
  subtitle: string;
  queryParams: Params;
  state: Signal<SectionState>;
  reload: () => void;
}

interface ReviewState {
  loading: boolean;
  reviews: Review[];
  error: string | null;
}

type TopPickMode = 'highlight' | 'trending' | 'latest' | 'free';

const AUTOPLAY_MS = 5000;
const HOME_PAGE_SIZE = 5;

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    NgOptimizedImage,
    LucideAngularModule,
    EventCard,
    EventCardSkeleton,
    EmptyState,
    ErrorState,
    ReviewCard,
  ],
  templateUrl: './home.html',
})
export class HomePage {
  private readonly eventService = inject(EventService);
  private readonly reviewService = inject(ReviewService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly upcomingSection = this.makeSection(
    'upcoming',
    'Segera hadir',
    'Event terdekat yang bisa kamu rencanakan',
    {},
  );

  protected readonly sections: Section[] = [
    this.makeSection('concert', 'Konser pilihan', 'Panggung musik dalam waktu dekat', {
      type: 'concert',
    }),
    this.makeSection('charity', 'Event amal', 'Hadir dan bantu sesama', { type: 'charity' }),
    this.makeSection('community', 'Komunitas', 'Kegiatan warga dan komunitas sekitar', {
      type: 'community',
    }),
  ];

  protected readonly categories: { label: string; type: EventType | '' }[] = [
    { label: 'Semua', type: '' },
    { label: EVENT_TYPE_LABEL.concert, type: 'concert' },
    { label: EVENT_TYPE_LABEL.charity, type: 'charity' },
    { label: EVENT_TYPE_LABEL.community, type: 'community' },
  ];

  protected readonly topPickOptions: { value: TopPickMode; label: string }[] = [
    { value: 'highlight', label: 'Sorotan' },
    { value: 'trending', label: 'Trending' },
    { value: 'latest', label: 'Terbaru' },
    { value: 'free', label: 'Gratis' },
  ];

  protected readonly activeSlide = signal(0);
  protected readonly topPickMode = signal<TopPickMode>('highlight');
  protected readonly hovering = signal(false);
  protected readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  protected readonly autoplayPaused = computed(() => this.hovering());

  protected readonly reviewState = signal<ReviewState>({
    loading: true,
    reviews: [],
    error: null,
  });

  private readonly bannerTrack = viewChild<ElementRef<HTMLDivElement>>('bannerTrack');
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly featured = computed(() => {
    const events = this.upcomingSection.state().events;
    const withPoster = events.filter((event) => event.cover_image_url);
    return (withPoster.length ? withPoster : events).slice(0, 4);
  });

  protected readonly topPicks = computed(() => {
    const events = this.upcomingSection.state().events;
    switch (this.topPickMode()) {
      case 'trending':
        return [...events]
          .sort(
            (a, b) =>
              b.going_count * 2 +
              b.review_count * 3 +
              b.rating_avg -
              (a.going_count * 2 + a.review_count * 3 + a.rating_avg),
          )
          .slice(0, 5);
      case 'latest':
        return [...events]
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, 5);
      case 'free':
        return events.filter((event) => event.price_min <= 0).slice(0, 5);
      default:
        return events.slice(0, 5);
    }
  });

  constructor() {
    this.loadReviews();
    if (!this.reducedMotion) {
      this.startAutoplay();
    }
    this.destroyRef.onDestroy(() => this.stopAutoplay());
  }

  protected typeLabel(type: EventType): string {
    return EVENT_TYPE_LABEL[type] ?? 'Event';
  }

  protected priceLabel(event: Event): string {
    return formatCompactPrice(event.price_min, event.currency);
  }

  protected dateLabel(event: Event): string {
    return formatEventDate(event.starts_at, event.ends_at);
  }

  protected goToSlide(index: number): void {
    const track = this.bannerTrack()?.nativeElement;
    if (!track) {
      return;
    }
    this.activeSlide.set(index);
    track.scrollTo({
      left: index * track.clientWidth,
      behavior: this.reducedMotion ? 'auto' : 'smooth',
    });
  }

  protected onBannerScroll(): void {
    const track = this.bannerTrack()?.nativeElement;
    if (!track || track.clientWidth === 0) {
      return;
    }
    this.activeSlide.set(Math.round(track.scrollLeft / track.clientWidth));
  }

  protected setTopPick(mode: TopPickMode): void {
    this.topPickMode.set(mode);
  }

  protected reloadReviews(): void {
    this.loadReviews();
  }

  private startAutoplay(): void {
    this.stopAutoplay();
    this.timerId = setInterval(() => {
      if (this.autoplayPaused() || document.hidden) {
        return;
      }
      const slides = this.featured();
      if (slides.length < 2) {
        return;
      }
      this.goToSlide((this.activeSlide() + 1) % slides.length);
    }, AUTOPLAY_MS);
  }

  private stopAutoplay(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private loadReviews(): void {
    this.reviewState.set({ loading: true, reviews: [], error: null });
    this.reviewService.list(1, 3).subscribe({
      next: (response) =>
        this.reviewState.set({ loading: false, reviews: response.data, error: null }),
      error: (error: unknown) =>
        this.reviewState.set({ loading: false, reviews: [], error: errorMessage(error) }),
    });
  }

  private makeSection(
    id: string,
    title: string,
    subtitle: string,
    params: Params,
    extraQuery: EventQuery = {},
  ): Section {
    const state = signal<SectionState>({ loading: true, events: [], error: null });

    const load = (): void => {
      state.set({ loading: true, events: [], error: null });
      this.eventService
        .list({
          ...extraQuery,
          type: (params['type'] as EventType) ?? '',
          from: wibStartOfDayIso(new Date()),
          pageSize: id === 'upcoming' ? 40 : HOME_PAGE_SIZE,
        })
        .subscribe({
          next: (response) => state.set({ loading: false, events: response.data, error: null }),
          error: (error: unknown) =>
            state.set({ loading: false, events: [], error: errorMessage(error) }),
        });
    };

    load();
    return { id, title, subtitle, queryParams: params, state: state.asReadonly(), reload: load };
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ReviewService } from '../../core/api/review.service';
import { Review, ReviewListResponse } from '../../core/models/review.model';
import { errorMessage } from '../../core/util/errors';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { ReviewCard } from '../../shared/ui/review-card/review-card';

const PAGE_SIZE = 9;

@Component({
  selector: 'app-reviews',
  imports: [RouterLink, LucideAngularModule, ReviewCard, EmptyState, ErrorState],
  templateUrl: './reviews.html',
})
export class ReviewsPage {
  private readonly reviewService = inject(ReviewService);

  protected readonly reviews = signal<Review[]>([]);
  protected readonly pagination = signal<ReviewListResponse['pagination'] | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly moreError = signal<string | null>(null);

  protected readonly total = computed(() => this.pagination()?.total ?? 0);
  protected readonly hasMore = computed(() => {
    const page = this.pagination();
    return page !== null && page.page < page.total_pages;
  });

  private requestId = 0;

  constructor() {
    this.load(1, false);
  }

  protected retry(): void {
    this.load(1, false);
  }

  protected loadMore(): void {
    const page = this.pagination();
    if (!page || this.loadingMore()) {
      return;
    }
    this.load(page.page + 1, true);
  }

  private load(page: number, append: boolean): void {
    const id = ++this.requestId;
    if (append) {
      this.loadingMore.set(true);
      this.moreError.set(null);
    } else {
      this.loading.set(true);
      this.error.set(null);
    }

    this.reviewService.list(page, PAGE_SIZE).subscribe({
      next: (response) => {
        if (id !== this.requestId) {
          return;
        }
        this.reviews.update((current) =>
          append ? [...current, ...response.data.filter((r) => !current.some((c) => c.id === r.id))] : response.data,
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
          this.reviews.set([]);
          this.pagination.set(null);
        }
      },
    });
  }
}

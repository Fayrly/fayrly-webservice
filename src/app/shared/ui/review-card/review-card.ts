import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ReviewService } from '../../../core/api/review.service';
import { Review } from '../../../core/models/review.model';
import { formatShortDate, initials } from '../../../core/util/format';

const RATING_LABEL: Record<number, string> = {
  5: 'Sangat memuaskan',
  4: 'Puas',
  3: 'Cukup baik',
  2: 'Kurang',
  1: 'Perlu perbaikan',
};

@Component({
  selector: 'app-review-card',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './review-card.html',
})
export class ReviewCard {
  private readonly reviewService = inject(ReviewService);

  readonly review = input.required<Review>();
  readonly showEvent = input(true);

  protected readonly expanded = signal(false);
  protected readonly helpfulCount = signal<number | null>(null);
  protected readonly marking = signal(false);
  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly userInitials = computed(() => initials(this.review().user_name));
  protected readonly dateLabel = computed(() => formatShortDate(this.review().created_at));
  protected readonly ratingLabel = computed(() => RATING_LABEL[this.review().rating] ?? 'Ulasan');
  protected readonly isLong = computed(() => this.review().body.length > 210);
  protected readonly currentHelpful = computed(
    () => this.helpfulCount() ?? this.review().helpful_count,
  );

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected markHelpful(): void {
    if (this.marking() || this.helpfulCount() !== null) {
      return;
    }
    this.marking.set(true);
    const previous = this.review().helpful_count;
    this.helpfulCount.set(previous + 1);
    this.reviewService.markHelpful(this.review().id).subscribe({
      next: (count) => {
        this.helpfulCount.set(count);
        this.marking.set(false);
      },
      error: () => {
        this.helpfulCount.set(null);
        this.marking.set(false);
      },
    });
  }
}

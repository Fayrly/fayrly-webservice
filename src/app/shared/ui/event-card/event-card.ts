import { NgClass, NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EVENT_TYPE_LABEL, Event } from '../../../core/models/event.model';
import { extraDays, formatCompactPrice, formatEventDate, initials } from '../../../core/util/format';
import { GoingStack } from '../going-stack/going-stack';

@Component({
  selector: 'app-event-card',
  imports: [RouterLink, NgOptimizedImage, NgClass, LucideAngularModule, GoingStack],
  templateUrl: './event-card.html',
})
export class EventCard {
  readonly event = input.required<Event>();
  readonly compact = input(false);

  protected readonly typeLabel = computed(() => EVENT_TYPE_LABEL[this.event().type] ?? 'Event');
  protected readonly orgInitials = computed(() => initials(this.event().organizer_name));
  protected readonly dateLabel = computed(() =>
    formatEventDate(this.event().starts_at, this.event().ends_at),
  );
  protected readonly extraDays = computed(() =>
    extraDays(this.event().starts_at, this.event().ends_at),
  );
  protected readonly priceLabel = computed(() =>
    formatCompactPrice(this.event().price_min, this.event().currency),
  );
  protected readonly isFree = computed(() => this.event().price_min <= 0);
  protected readonly posterSizes = '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw';
}

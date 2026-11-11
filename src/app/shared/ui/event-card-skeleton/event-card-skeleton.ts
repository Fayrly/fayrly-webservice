import { Component } from '@angular/core';

@Component({
  selector: 'app-event-card-skeleton',
  template: `
    <div class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card" aria-hidden="true">
      <div class="skeleton aspect-video rounded-none"></div>
      <div class="space-y-3 p-4">
        <div class="skeleton h-4 w-4/5"></div>
        <div class="skeleton h-3 w-1/2"></div>
        <div class="skeleton h-3 w-3/4"></div>
        <div class="skeleton h-3 w-2/3"></div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-3">
          <div class="skeleton h-3 w-16"></div>
          <div class="skeleton h-5 w-24"></div>
        </div>
      </div>
    </div>
  `,
})
export class EventCardSkeleton {}

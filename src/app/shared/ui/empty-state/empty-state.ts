import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  imports: [LucideAngularModule],
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly title = input('Belum ada event');
  readonly message = input('Coba ubah kata kunci atau filter pencarianmu.');
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}

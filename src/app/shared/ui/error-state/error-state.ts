import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-error-state',
  imports: [LucideAngularModule],
  templateUrl: './error-state.html',
})
export class ErrorState {
  readonly message = input('Terjadi kesalahan saat memuat data.');
  readonly retry = output<void>();
}

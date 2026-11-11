import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/api/auth.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class AppFooter {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();
}

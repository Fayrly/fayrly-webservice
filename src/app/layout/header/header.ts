import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { initials } from '../../core/util/format';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select';

@Component({
  selector: 'app-header',
  imports: [RouterLink, LucideAngularModule, SelectComponent],
  templateUrl: './header.html',
})
export class AppHeader {
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  private readonly mobileSearch = viewChild<ElementRef<HTMLInputElement>>('mobileSearch');

  protected readonly cities = signal<string[]>([]);
  protected readonly city = signal('');
  protected readonly query = signal('');
  protected readonly searchOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly subnavHidden = signal(false);
  private lastScrollY = 0;

  protected readonly user = this.auth.user;
  protected readonly initials = computed(() => initials(this.auth.user()?.name ?? ''));
  protected readonly firstName = computed(() => this.auth.user()?.name.split(/\s+/)[0] ?? '');
  protected readonly cityOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Semua kota' },
    ...this.cities().map((city) => ({ value: city, label: city })),
  ]);

  constructor() {
    this.eventService.list({ pageSize: 100 }).subscribe({
      next: (response) => {
        const unique = [...new Set(response.data.map((event) => event.city).filter(Boolean))];
        this.cities.set(unique.sort((a, b) => a.localeCompare(b, 'id')));
      },
      error: () => this.cities.set([]),
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const params = this.router.parseUrl(this.router.url).queryParams;
        this.city.set(typeof params['city'] === 'string' ? params['city'] : '');
        this.query.set(typeof params['q'] === 'string' ? params['q'] : '');
      });

    effect(() => {
      document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
    });

    this.lastScrollY = window.scrollY;
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', this.onWindowScroll));
  }

  private readonly onWindowScroll = (): void => {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    if (Math.abs(delta) < 8) {
      return;
    }
    this.subnavHidden.set(delta > 0 && y > 48);
    this.lastScrollY = y;
  };

  protected onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();
    this.searchOpen.set(false);
    const q = this.query().trim();
    this.router.navigate(['/events'], {
      queryParams: { q: q || null, city: this.city() || null },
    });
  }

  protected onCitySelected(city: string): void {
    this.city.set(city);
    this.router.navigate(['/events'], {
      queryParams: { city: city || null, q: this.query() || null },
    });
  }

  protected toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (this.searchOpen()) {
      queueMicrotask(() => this.mobileSearch()?.nativeElement.focus());
    }
  }

  protected logout(): void {
    this.auth.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }
}

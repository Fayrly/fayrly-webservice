import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChevronDown, LogOut, LucideAngularModule, MapPin, Menu, Search, X } from 'lucide-angular';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        importProvidersFrom(
          LucideAngularModule.pick({ ChevronDown, LogOut, MapPin, Menu, Search, X }),
        ),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand and skip link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('fayrly');
    expect(compiled.querySelector('a[href="#konten"]')).toBeTruthy();
  });
});

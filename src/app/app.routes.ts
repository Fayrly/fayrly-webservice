import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Fayrly — Temukan event, konser, dan kegiatan amal',
    loadComponent: () => import('./features/home/home').then((m) => m.HomePage),
  },
  {
    path: 'events',
    title: 'Jelajahi event — Fayrly',
    loadComponent: () => import('./features/events/events').then((m) => m.EventsPage),
  },
  {
    path: 'events/:slug/tiket',
    title: 'Pilih tiket — Fayrly',
    loadComponent: () => import('./features/ticket/ticket').then((m) => m.TicketPage),
  },
  {
    path: 'events/:slug',
    title: 'Detail event — Fayrly',
    loadComponent: () =>
      import('./features/event-detail/event-detail').then((m) => m.EventDetailPage),
  },
  {
    path: 'ulasan',
    title: 'Ulasan pengguna — Fayrly',
    loadComponent: () => import('./features/reviews/reviews').then((m) => m.ReviewsPage),
  },
  {
    path: 'masuk',
    title: 'Masuk — Fayrly',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'daftar',
    title: 'Daftar — Fayrly',
    loadComponent: () => import('./features/register/register').then((m) => m.RegisterPage),
  },
  {
    path: 'lupa-password',
    title: 'Lupa kata sandi — Fayrly',
    loadComponent: () =>
      import('./features/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage),
  },
  { path: '**', redirectTo: '' },
];

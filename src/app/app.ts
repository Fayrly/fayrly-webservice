import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppFooter } from './layout/footer/footer';
import { AppHeader } from './layout/header/header';

@Component({
  imports: [RouterOutlet, AppHeader, AppFooter],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}

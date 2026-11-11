import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export interface SelectOption {
  value: string;
  label: string;
}

let nextSelectId = 0;

@Component({
  selector: 'app-select',
  imports: [LucideAngularModule],
  templateUrl: './select.html',
  host: {
    class: 'block',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class SelectComponent {
  readonly options = input<SelectOption[]>([]);
  readonly value = input('');
  readonly placeholder = input('Pilih opsi');
  readonly icon = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly listId = `select-list-${nextSelectId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly selectedLabel = computed(() => {
    const match = this.options().find((option) => option.value === this.value());
    return match?.label ?? this.placeholder();
  });

  protected optionId(index: number): string {
    return `${this.listId}-option-${index}`;
  }

  protected toggle(): void {    if (this.open()) {
      this.close();
      return;
    }
    this.openPanel();
  }

  protected openPanel(): void {
    const index = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(index >= 0 ? index : 0);
    this.open.set(true);
  }

  protected close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected choose(option: SelectOption): void {
    this.valueChange.emit(option.value);
    this.close();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
        } else {
          this.move(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
        } else {
          this.move(-1);
        }
        break;
      case 'Home':
        if (this.open()) {
          event.preventDefault();
          this.activeIndex.set(0);
        }
        break;
      case 'End':
        if (this.open()) {
          event.preventDefault();
          this.activeIndex.set(this.options().length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open()) {
          const option = this.options()[this.activeIndex()];
          if (option) {
            this.choose(option);
          }
        } else {
          this.openPanel();
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }

  private move(delta: number): void {
    const count = this.options().length;
    if (count === 0) {
      return;
    }
    this.activeIndex.update((index) => (index + delta + count) % count);
  }
}

import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { initials } from '../../../core/util/format';

const AVATAR_STYLES = [
  'bg-mint-100 text-mint-800',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-crimson-50 text-crimson-700',
];

@Component({
  selector: 'app-going-stack',
  imports: [LucideAngularModule],
  templateUrl: './going-stack.html',
})
export class GoingStack {
  readonly names = input<string[]>([]);
  readonly count = input(0);
  readonly compact = input(false);
  readonly showLabel = input(true);

  protected readonly visible = computed(() => this.names().filter(Boolean).slice(0, 3));
  protected readonly remaining = computed(() => Math.max(0, this.count() - this.visible().length));

  protected avatarStyle(index: number): string {
    return AVATAR_STYLES[index % AVATAR_STYLES.length];
  }

  protected avatarInitials(name: string): string {
    return initials(name);
  }
}

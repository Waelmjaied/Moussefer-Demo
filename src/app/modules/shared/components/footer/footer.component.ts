import { Component } from '@angular/core';
import { SharedModule } from '../../shared.module';
import { ToastService } from '../../../../core/services/toast.service'; // ← ajouter

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  imports: [SharedModule],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  constructor(private toast: ToastService) {} // ← ajouter

  onNewsletterSubmit(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector('input');
    if (input && input.value) {
      this.toast.success(`Merci de vous être abonné avec : ${input.value}`);
      input.value = '';
    }
  }
}

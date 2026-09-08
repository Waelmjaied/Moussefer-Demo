import { Injectable, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { ConfirmModalComponent } from '../../modules/shared/confirm-modal/confirm-modal.component';

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector,
  ) {}

  confirm(message: string, title: string = 'Confirmation'): Promise<boolean> {
    return new Promise((resolve) => {
      // Create the component dynamically
      const componentRef = createComponent(ConfirmModalComponent, {
        environmentInjector: this.injector,
      });

      // Set inputs
      componentRef.instance.title = title;
      componentRef.instance.message = message;
      componentRef.instance.confirmText = 'Confirmer';
      componentRef.instance.cancelText = 'Annuler';

      // Attach to DOM
      document.body.appendChild(componentRef.location.nativeElement);
      this.appRef.attachView(componentRef.hostView);

      // Handle events
      const confirmSub = componentRef.instance.confirm.subscribe(() => {
        resolve(true);
        cleanup();
      });
      const cancelSub = componentRef.instance.cancel.subscribe(() => {
        resolve(false);
        cleanup();
      });

      const cleanup = () => {
        confirmSub.unsubscribe();
        cancelSub.unsubscribe();
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      };
    });
  }
}

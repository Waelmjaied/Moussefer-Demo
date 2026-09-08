import { Injectable, NgZone } from '@angular/core';
import { fromEvent, timer } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private idleTime = 30 * 60 * 1000; // 30 minutes
  private timer$: any;

  constructor(
    private authService: AuthService,
    private ngZone: NgZone,
  ) {
    this.init();
  }

  init() {
    this.resetTimer();
    this.ngZone.runOutsideAngular(() => {
      fromEvent(document, 'mousemove')
        .pipe(throttleTime(1000))
        .subscribe(() => this.resetTimer());
      fromEvent(document, 'keydown')
        .pipe(throttleTime(1000))
        .subscribe(() => this.resetTimer());
    });
  }

  private resetTimer() {
    if (this.timer$) clearTimeout(this.timer$);
    this.timer$ = setTimeout(() => this.logout(), this.idleTime);
  }

  private logout() {
    this.authService.logout();
    window.location.href = '/auth/login';
  }
}

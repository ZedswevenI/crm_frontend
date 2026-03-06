import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  username: any = '';
  email: any = '';

  constructor(private router: Router) {
    this.username = localStorage.getItem('name');
    this.email = localStorage.getItem('email');
  }
  logout() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/auth/login']);
  }
}

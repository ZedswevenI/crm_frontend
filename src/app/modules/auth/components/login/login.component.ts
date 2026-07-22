import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../service/auth/auth.service';
import { AlertService } from '../../../../service/alert/alert.service';

const ALLOWED_LOGIN_ROLES = ['L1', 'L2', 'L6'];

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  showPassword = false;
  loading = false;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public service: AuthService,
    private alert: AlertService
  ) {
    this.service.formReset$.subscribe(() => {
      this.loading = false;
      this.form.reset();
    });
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get f() {
    return this.form.controls;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.form.invalid || this.loading) return;

    this.loading = true;

    this.service
      .signIn(this.form.value, 'ims/user', 'login')
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response?.data) {
            const roleLevel = String(response.data.roleLevel || '').trim();
            if (!ALLOWED_LOGIN_ROLES.includes(roleLevel)) {
              this.alert.error(
                'You are not authorized to access this application.'
              );
              return;
            }
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('tenantId', response.data.tenantId);
            localStorage.setItem('userid', response.data.userId);
            localStorage.setItem('userRole', roleLevel);
            localStorage.setItem('email', response.data.email);
            localStorage.setItem('name', response.data.name);
            this.alert.success('Login Successful!!');
            this.router.navigateByUrl('/app/dashboard');
          } else {
            this.alert.error('Unexpected response.');
          }
        },
        error: () => {
          this.alert.error(
            'Login Failed. Please enter correct Email/Password'
          );
          this.loading = false;
        }
      });
  }
}

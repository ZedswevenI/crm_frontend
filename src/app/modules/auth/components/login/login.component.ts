import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../../service/auth/auth.service';
import { AlertService } from '../../../../service/alert/alert.service';

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

    this.service.signIn(this.form.value, 'ims/user', 'login').subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alert.error(
          err?.error?.message || 'Login Failed. Please enter correct Email/Password'
        );
      },
    });
  }
}

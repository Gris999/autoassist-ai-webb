import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { TokenService } from '../../../../core/services/token.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private tokenService = inject(TokenService);
  private router = inject(Router);

  loading = false;
  errorMessage = '';
  showPassword = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const payload = {
      email: this.form.value.email ?? '',
      password: this.form.value.password ?? '',
    };

    this.authService.login(payload).subscribe({
      next: (response) => {
        this.tokenService.setToken(response.access_token);
        this.resolveCurrentUserAndRedirect();
      },
      error: (error) => {
        console.error('Error de login:', error);
        this.errorMessage = 'Credenciales invalidas o error de conexion.';
        this.loading = false;
      },
    });
  }

  private resolveCurrentUserAndRedirect(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.tokenService.setCurrentUser(user);
        this.loading = false;

        const userRoles = Array.isArray(user.roles)
          ? user.roles.map((role) => role.toLowerCase())
          : [];
        const route = userRoles
          .map((role) => this.tokenService.getDashboardRoute(role))
          .find((value) => !!value);

        if (!route) {
          this.tokenService.clearSession();
          this.errorMessage =
            'No pudimos determinar el panel para este usuario. Verifica su rol.';
          return;
        }

        this.router.navigate([route]);
      },
      error: (error) => {
        console.error('Error al obtener el usuario autenticado:', error);
        this.tokenService.clearSession();
        this.errorMessage =
          'Se inicio sesion, pero no pudimos obtener tu perfil. Intenta nuevamente.';
        this.loading = false;
      },
    });
  }
}

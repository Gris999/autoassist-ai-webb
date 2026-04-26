import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthMeResponse } from '../models/auth-me-response.model';
import { LoginRequest } from '../models/login-request.model';
import { LoginResponse } from '../models/login-response.model';
import { RegisterWorkshopRequest } from '../models/register-workshop-request.model';
import { RegisterWorkshopResponse } from '../models/register-workshop-response.model';
import { WorkshopType } from '../models/workshop-type.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, data);
  }

  logout(): Observable<{
    message: string;
    invalidacion_servidor: boolean;
  }> {
    return this.http.post<{
      message: string;
      invalidacion_servidor: boolean;
    }>(`${this.apiUrl}/auth/logout`, {});
  }

  getCurrentUser(): Observable<AuthMeResponse> {
    return this.http.get<AuthMeResponse>(`${this.apiUrl}/auth/me`);
  }

  getWorkshopTypes(): Observable<WorkshopType[]> {
    return this.http.get<WorkshopType[]>(`${this.apiUrl}/auth/tipos-taller`);
  }

  registerWorkshop(
    data: RegisterWorkshopRequest
  ): Observable<RegisterWorkshopResponse> {
    return this.http.post<RegisterWorkshopResponse>(
      `${this.apiUrl}/auth/register/taller`,
      data
    );
  }
}

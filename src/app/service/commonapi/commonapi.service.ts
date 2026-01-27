import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environments';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CommonapiService {
  headers = new HttpHeaders().set('Content-Type', 'application/json');

  constructor(private http: HttpClient) {}

  // =========================
  // GENERIC POST (existing)
  // =========================
  fetchData(payload: any, module: string, endpoint: string): Observable<any> {
    return this.http
      .post(`${environment.baseURL}/${module}/${endpoint}`, payload, {
        headers: this.headers
      });
  }

  // =========================
  // GENERIC GET (NEW)
  // =========================
  getData(module: string, endpoint: string, params?: any): Observable<any> {
    return this.http
      .get(`${environment.baseURL}/${module}/${endpoint}`, {
        headers: this.headers,
        params
      });
  }

  // =========================
  // FILE DOWNLOAD (existing)
  // =========================
  downloadByUrl(payload: any, module: string, endpoint: string): Observable<Blob> {
    return this.http.post(
      `${environment.baseURL}/${module}/${endpoint}`,
      payload,
      { responseType: 'blob' }
    );
  }

  //Error Handling
  handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    window.alert(errorMessage);
    return errorMessage;
  }
}

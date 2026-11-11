import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Event, EventListResponse, EventQuery } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);

  list(query: EventQuery = {}): Observable<EventListResponse> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('page_size', String(query.pageSize ?? 20));

    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.city?.trim()) {
      params = params.set('city', query.city.trim());
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }

    return this.http.get<EventListResponse>('/events', { params });
  }

  get(idOrSlug: string): Observable<Event> {
    return this.http
      .get<{ data: Event }>(`/events/${encodeURIComponent(idOrSlug)}`)
      .pipe(map((response) => response.data));
  }
}

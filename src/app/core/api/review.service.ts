import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CreateReviewRequest,
  EventReviewListResponse,
  Review,
  ReviewListResponse,
} from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);

  list(page = 1, pageSize = 9): Observable<ReviewListResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('page_size', String(pageSize));
    return this.http.get<ReviewListResponse>('/events/reviews', { params });
  }

  listForEvent(idOrSlug: string, pageSize = 5): Observable<EventReviewListResponse> {
    const params = new HttpParams().set('page', '1').set('page_size', String(pageSize));
    return this.http.get<EventReviewListResponse>(
      `/events/${encodeURIComponent(idOrSlug)}/reviews`,
      { params },
    );
  }

  create(idOrSlug: string, payload: CreateReviewRequest): Observable<Review> {
    return this.http
      .post<{ data: Review }>(`/events/${encodeURIComponent(idOrSlug)}/reviews`, payload)
      .pipe(map((response) => response.data));
  }

  markHelpful(id: string): Observable<number> {
    return this.http
      .post<{ helpful_count: number }>(`/events/reviews/${encodeURIComponent(id)}/helpful`, {})
      .pipe(map((response) => response.helpful_count));
  }
}

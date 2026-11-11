export interface Review {
  id: string;
  event_id: string;
  event_slug: string;
  event_title: string;
  event_cover_url: string;
  event_starts_at: string;
  user_id: string;
  user_name: string;
  rating: number;
  body: string;
  photo_url?: string;
  helpful_count: number;
  created_at: string;
}

export interface ReviewSummary {
  count: number;
  average: number;
}

export interface ReviewListResponse {
  data: Review[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface EventReviewListResponse {
  data: Review[];
  summary: ReviewSummary;
}

export interface CreateReviewRequest {
  rating: number;
  body: string;
  photo_url?: string;
}

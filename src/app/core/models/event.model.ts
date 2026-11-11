export type EventType = 'concert' | 'charity' | 'community';

export type EventStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  venue_name: string;
  venue_address: string;
  city: string;
  country: string;
  starts_at: string;
  ends_at?: string | null;
  capacity: number;
  price_min: number;
  price_max: number;
  currency: string;
  cover_image_url: string;
  organizer_name: string;
  contact_email: string;
  contact_phone: string;
  tags: string[];
  beneficiary?: string;
  donation_target?: number;
  donation_raised?: number;
  created_by: string;
  created_by_name: string;
  updated_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  going_count: number;
  going_names: string[];
  review_count: number;
  rating_avg: number;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface EventListResponse {
  data: Event[];
  pagination: Pagination;
}

export interface EventQuery {
  q?: string;
  type?: EventType | '';
  city?: string;
  status?: EventStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  concert: 'Konser',
  charity: 'Amal',
  community: 'Komunitas',
};

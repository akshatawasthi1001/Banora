export type UserRole = "CLIENT" | "CONTRACTOR";

export type ProjectStatus = "ONGOING" | "COMPLETED";

export type ProjectType =
| "RESIDENTIAL"
| "COMMERCIAL"
| "RENOVATION"
| "INTERIOR"
| "OTHER";

export type MediaType = "IMAGE" | "VIDEO";

export type InquiryStatus = "NEW" | "CONTACTED" | "CLOSED";

export interface User {
id: string;
email: string;
role: UserRole;
is_active: boolean;
created_at: string;
updated_at: string;
}

export interface ContractorProfile {
id: string;
name: string;
company_name: string | null;
bio: string | null;
profile_image_url: string | null;
phone: string | null;
city: string;
state: string;
country: string;
latitude: number | null;
longitude: number | null;
experience_years: number;
created_at: string;
updated_at: string;
}

export interface ContractorList {
items: ContractorProfile[];
page: number;
page_size: number;
total: number;
total_pages: number;
}

export interface Project {
id: string;
contractor_id: string;
title: string;
description: string | null;
project_type: ProjectType;
city: string;
state: string;
country: string;
latitude: number | null;
longitude: number | null;
plot_area_sqft: number | null;
built_up_area_sqft: number | null;
floors: number | null;
budget_min: number | null;
budget_max: number | null;
start_date: string | null;
completion_date: string | null;
status: ProjectStatus;
created_at: string;
updated_at: string;
}

export interface ProjectList {
items: Project[];
page: number;
page_size: number;
total: number;
total_pages: number;
}

export interface Review {
id: string;
rating: number;
comment: string | null;
created_at: string;
updated_at: string;
}

export interface RatingSummary {
contractor_id: string;
average_rating: number;
review_count: number;
rating_distribution: Record<string, number>;
}

export interface ReviewList {
items: Review[];
page: number;
page_size: number;
total: number;
total_pages: number;
}

export interface ReviewInput {
rating: number;
comment?: string | null;
}

export interface ReviewPatchInput {
rating?: number;
comment?: string | null;
}

export interface MediaAsset {
id: string;
media_type: MediaType;
url: string;
thumbnail_url: string | null;
alt_text: string | null;
caption: string | null;
display_order: number;
created_at: string;
updated_at: string;
}export type ConstructionStageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface ConstructionStage {
  id: string;
  name: string;
  stage_order: number;
  status: ConstructionStageStatus;
started_at: string | null;
completed_at: string | null;
created_at: string;
updated_at: string;
}

export interface ProgressUpdate {
id: string;
title: string;
description: string | null;
progress_percentage: number;
update_date: string;
created_at: string;
updated_at: string;
}

export interface JourneyStage extends ConstructionStage {
progress_updates: ProgressUpdate[];
}export interface ProjectJourney {
  project_id: string;
  stages: JourneyStage[];
}

export interface ProgressUpdateInput {
  title: string;
  description?: string | null;
  progress_percentage: number;
  update_date: string;
}

export interface ProgressUpdatePatchInput {
  title?: string;
  description?: string | null;
  progress_percentage?: number;
  update_date?: string;
}

export interface ConstructionStagePatchInput {
  name?: string;
  stage_order?: number;
  status?: ConstructionStageStatus;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface MediaCreateInput {
  media_type: MediaType;
  url: string;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  display_order?: number;
}

export interface ApiError {
detail?: string | ApiErrorDetail[];
message?: string;
}

/** FastAPI 422 responses return an array of these issue objects. */
export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

export interface LoginResponse {
access_token: string;
token_type: string;
}export interface ContractorProfileInput {
  name: string;
  company_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  phone: string | null;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  experience_years: number;
}

export interface ProjectInput {
  title: string;
  description?: string | null;
project_type: ProjectType;
city: string;
state: string;
country: string;
plot_area_sqft?: number | null;
built_up_area_sqft?: number | null;
floors?: number | null;
budget_min?: number | null;
budget_max?: number | null;
start_date?: string | null;
completion_date?: string | null;
status?: ProjectStatus;
}

/* =========================
Auth Types
========================= */

export interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
}

/* =========================
Inquiry Types
========================= */

export interface Inquiry {
  id: string;
  client_id: string;
  contractor_profile_id: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

export interface InquiryList {
items: Inquiry[];
page: number;
page_size: number;
total: number;
total_pages: number;
}

export interface CreateInquiryInput {
contractor_id: string;
subject: string;
message: string;
}

export interface UpdateInquiryStatusInput {
status: InquiryStatus;
}

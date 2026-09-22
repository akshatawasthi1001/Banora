import { apiGet, apiPatch, apiPost } from "./client";
import type {
CreateInquiryInput,
Inquiry,
InquiryList,
UpdateInquiryStatusInput,
} from "./types";

export function createInquiry(
input: CreateInquiryInput,
): Promise<Inquiry> {
return apiPost<Inquiry>("/inquiries", input);
}

export function getMyInquiries(
page = 1,
pageSize = 10,
): Promise<InquiryList> {
return apiGet<InquiryList>(
`/inquiries/me?page=${page}&page_size=${pageSize}`,
);
}

export function getReceivedInquiries(
page = 1,
pageSize = 10,
): Promise<InquiryList> {
return apiGet<InquiryList>(
`/inquiries/received?page=${page}&page_size=${pageSize}`,
);
}

export function getInquiry(
inquiryId: string,
): Promise<Inquiry> {
return apiGet<Inquiry>(`/inquiries/${inquiryId}`);
}

export function updateInquiryStatus(
inquiryId: string,
input: UpdateInquiryStatusInput,
): Promise<Inquiry> {
return apiPatch<Inquiry>(
`/inquiries/${inquiryId}/status`,
input,
);
}

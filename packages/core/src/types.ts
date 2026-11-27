/** A single bill with split information */
export interface Bill {
  id: string;
  title: string;
  totalAmount: number;
  participants: string[];
  splitAmount: number;
  createdAt: string;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

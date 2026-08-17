export interface Category {
  id: number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface CreateCategoryRequest {
  code: string;
  name: string;
  description: string | null;
}

export interface UpdateCategoryRequest {
  name: string;
  description: string | null;
  active: boolean | null;
}

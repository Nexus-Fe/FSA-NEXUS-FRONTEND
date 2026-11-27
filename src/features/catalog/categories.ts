import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type Category = { id: string; categoryId?: string; name: string; parentId?: string | null; children?: Category[] | null };
type CategoryList = Category[] | { items?: Category[]; data?: Category[]; results?: Category[]; categories?: Category[]; pagination?: { hasNextPage?: boolean } };

function categoryRows(value: CategoryList | null): Category[] {
  return Array.isArray(value) ? value : value?.items ?? value?.data ?? value?.results ?? value?.categories ?? [];
}

function normalizeCategories(list: Category[], parentId: string | null = null): Category[] {
  return list.flatMap((category) => {
    const id = category.id ?? category.categoryId ?? "";
    return [
      { ...category, id, parentId: category.parentId ?? parentId },
      ...normalizeCategories(category.children ?? [], id),
    ];
  }).filter((category) => Boolean(category.id));
}

export async function loadCategories(signal?: AbortSignal): Promise<Category[]> {
  const all: Category[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = unwrap(await api.get<ApiResponse<CategoryList>>(`/api/v1/categories?page=${page}&pageSize=100`, { signal }));
    all.push(...categoryRows(result));
    if (Array.isArray(result) || !result.pagination?.hasNextPage) break;
  }
  return [...new Map(normalizeCategories(all).map((category) => [category.id, category])).values()];
}

export function categoryGroups(categories: Category[]) {
  const ids = new Set(categories.map((category) => category.id));
  const roots = categories.filter((category) => !category.parentId || !ids.has(category.parentId));
  const descendants = (id: string, seen = new Set<string>()): Category[] => {
    if (seen.has(id)) return [];
    const visited = new Set([...seen, id]);
    return categories.filter((category) => category.parentId === id).flatMap((child) => [
      child,
      ...descendants(child.id, visited),
    ]);
  };
  return roots.map((parent) => ({ parent, children: descendants(parent.id) }));
}

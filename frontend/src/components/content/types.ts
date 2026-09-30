// Shapes returned by /content/* (contract: `image`; older builds used `image_url` — see imageOf()).

export interface ContentPaged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface ServiceItem {
  slug: string;
  title: string;
  short: string;
  body: string;
  image?: string | null;
  image_url?: string | null;
}

export interface ProjectItem {
  slug: string;
  title: string;
  year: string;
  date: string;
  object: string | null;
  service: string | null;
  image?: string | null;
  image_url?: string | null;
  excerpt?: string | null;
  body?: string | null;
}

export interface NewsEntry {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  image?: string | null;
  image_url?: string | null;
  body?: string | null;
  tags?: string[] | null;
}

export interface CmsPage {
  slug: string;
  title: string;
  body_html: string;
}

export interface ConfiguratorItem {
  slug: string;
  name: string;
  description: string;
  url: string;
  image?: string | null;
  image_url?: string | null;
}

export interface StoreItem {
  id: number;
  city: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  delivery_hint?: string | null;
}

/** Image path regardless of which field name the backend emitted. */
export function imageOf(x: { image?: string | null; image_url?: string | null }): string | null {
  return x.image ?? x.image_url ?? null;
}

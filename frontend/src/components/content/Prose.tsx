import { cn } from "@/lib/cn";

/** Renders our own CMS HTML (seeded/backoffice content, not user input). */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose-tek", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

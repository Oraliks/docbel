import {
  listAdminCategories,
  listAdminTags,
  listAdminBadges,
} from "@/lib/formations/admin-queries";
import { CategoriesClient } from "./categories-client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, tags, badges] = await Promise.all([
    listAdminCategories(),
    listAdminTags(),
    listAdminBadges(),
  ]);

  return (
    <CategoriesClient categories={categories} tags={tags} badges={badges} />
  );
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity, type ActivityAction } from "@/lib/activity-logger";

type TransitionInput = {
  id: string;
  data: Prisma.NewsUpdateInput;
  action: ActivityAction;
  detailsTemplate: (title: string) => string;
  actor: string;
  updatedBy?: string;
};

export async function applyNewsTransition({
  id,
  data,
  action,
  detailsTemplate,
  actor,
  updatedBy,
}: TransitionInput) {
  const article = await prisma.news.update({
    where: { id },
    data: { ...data, ...(updatedBy ? { updatedBy } : {}) },
  });

  await logActivity(
    actor,
    action,
    "news",
    article.title,
    article.id,
    detailsTemplate(article.title)
  );

  return article;
}

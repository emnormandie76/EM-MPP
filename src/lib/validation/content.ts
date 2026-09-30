import { z } from "zod";

// Categories, announcements and prizes inputs, shared by the services and the back-office forms
// (architecture §5.11, §8.3).

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 40;
export const ANNOUNCEMENT_MAX = 500;
export const PRIZE_RANK_MAX = 20;
export const PRIZE_DESCRIPTION_MAX = 200;
export const PRIZES_MAX = 10;

export const CONTENT_MESSAGES = {
  categoryName: `Le nom doit faire de ${CATEGORY_NAME_MIN} à ${CATEGORY_NAME_MAX} caractères.`,
  announcementBody: `L'annonce doit faire de 1 à ${ANNOUNCEMENT_MAX} caractères.`,
  prizeRank: `Le rang doit faire de 1 à ${PRIZE_RANK_MAX} caractères (par exemple « 1er »).`,
  prizeDescription: `Le lot doit faire de 1 à ${PRIZE_DESCRIPTION_MAX} caractères.`,
  prizesCount: `${PRIZES_MAX} lots au plus.`,
} as const;

const M = CONTENT_MESSAGES;

export const categoryNameSchema = z
  .string(M.categoryName)
  .trim()
  .min(CATEGORY_NAME_MIN, M.categoryName)
  .max(CATEGORY_NAME_MAX, M.categoryName);

export const announcementBodySchema = z
  .string(M.announcementBody)
  .trim()
  .min(1, M.announcementBody)
  .max(ANNOUNCEMENT_MAX, M.announcementBody);

export const prizeSchema = z.object({
  rankLabel: z.string(M.prizeRank).trim().min(1, M.prizeRank).max(PRIZE_RANK_MAX, M.prizeRank),
  description: z
    .string(M.prizeDescription)
    .trim()
    .min(1, M.prizeDescription)
    .max(PRIZE_DESCRIPTION_MAX, M.prizeDescription),
});

export const prizesSchema = z.array(prizeSchema, M.prizesCount).max(PRIZES_MAX, M.prizesCount);

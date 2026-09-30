import { z } from "zod";
import { seasonStartFromLocalDate } from "@/lib/game/time";

// Categories, seasons, announcements and prizes inputs, shared by the services and the back-office forms
// (architecture §5.11, §8.3).

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 40;
export const SEASON_NAME_MIN = 2;
export const SEASON_NAME_MAX = 40;
export const ANNOUNCEMENT_MAX = 500;
export const PRIZE_RANK_MAX = 20;
export const PRIZE_DESCRIPTION_MAX = 200;
export const PRIZES_MAX = 10;

export const CONTENT_MESSAGES = {
  categoryName: `Le nom doit faire de ${CATEGORY_NAME_MIN} à ${CATEGORY_NAME_MAX} caractères.`,
  seasonName: `Le nom doit faire de ${SEASON_NAME_MIN} à ${SEASON_NAME_MAX} caractères.`,
  seasonStart: "Indique la date de début.",
  seasonStartInvalid: "Date invalide.",
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

export const seasonNameSchema = z.string(M.seasonName).trim().min(SEASON_NAME_MIN, M.seasonName).max(SEASON_NAME_MAX, M.seasonName);

/** An `<input type="date">` value, read as 00:00 that day, Paris time (§5.13). */
export const seasonStartSchema = z
  .string(M.seasonStart)
  .trim()
  .transform((value, ctx) => {
    if (value === "") {
      ctx.addIssue({ code: "custom", message: M.seasonStart });
      return z.NEVER;
    }
    try {
      return seasonStartFromLocalDate(value);
    } catch {
      ctx.addIssue({ code: "custom", message: M.seasonStartInvalid });
      return z.NEVER;
    }
  });

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

-- Fin du chantier du portail (B4, D9) : après cette migration, aucun retour vers l'ancienne connexion.
-- Les mots de passe hachés de l'ancienne connexion : on se connecte par le portail depuis la bascule (B3).
-- Ajouté à la main : drizzle-kit ne produit que le DROP TABLE.
DELETE FROM "account" WHERE "provider_id" = 'credential';--> statement-breakpoint
-- L'ancienne liste blanche de l'inscription : les accès se donnent dans la grille du portail (G2).
DROP TABLE "allowed_email" CASCADE;

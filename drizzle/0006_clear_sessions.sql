-- Connexion par le portail (D6) : toutes les sessions d'avant la bascule cessent au déploiement.
-- Une session ouverte par mot de passe resterait sinon valable jusqu'à 400 jours, hors du portail.
DELETE FROM "session";

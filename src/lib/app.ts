// Name of the site (architecture §11, É8b): the only place where it is written. The interface, the
// tab titles and Better Auth read it from here.

export const APP_NAME = "Les petits pronos de la promo";

/** The logo shows the name on two lines: on one line, it would not fit a phone (390 px). */
export const APP_NAME_LINES = ["Les petits pronos", "de la promo"] as const;

/**
 * The rules page is for admins only until step 10 (architecture §6.4, point 6, v1.4, decision of the
 * user of 12/10/2026). Step 10 (rules set per season, v1.3) sets this to `true`, which opens the page
 * and its links to every player.
 */
export const RULES_PAGE_FOR_PLAYERS = false;

/**
 * Whether the rules page and its links (header, phone menu, footer, /lots) show: always to an admin,
 * to everyone once the page is open to the players. `forPlayers` is only given by the tests.
 */
export function canSeeRulesPage(isAdmin: boolean, forPlayers: boolean = RULES_PAGE_FOR_PLAYERS): boolean {
  return isAdmin || forPlayers;
}

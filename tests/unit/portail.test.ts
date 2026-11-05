import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRole, portailClient, portailHomeUrl, portailIssuer, ROLES } from "@/lib/auth/portail";

// Variables and addresses of the portal (architecture §3.1, §6.2).

const ENV = {
  PORTAIL_ISSUER: "https://portail.example.test/api/auth",
  PORTAIL_CLIENT_ID: "client",
  PORTAIL_CLIENT_SECRET: "secret",
};

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });
}

describe("the portal's variables", () => {
  it("reads the issuer, without spaces or a trailing slash", () => {
    expect(portailIssuer(ENV)).toBe("https://portail.example.test/api/auth");
    expect(portailIssuer({ PORTAIL_ISSUER: " https://portail.example.test/api/auth/ " })).toBe("https://portail.example.test/api/auth");
    expect(portailIssuer({})).toBeNull();
    expect(portailIssuer({ PORTAIL_ISSUER: "  " })).toBeNull();
  });

  it("has a client only with its three variables: any other preview has no sign-in (G12)", () => {
    expect(portailClient(ENV)).toEqual({ issuer: ENV.PORTAIL_ISSUER, clientId: "client", clientSecret: "secret" });
    expect(portailClient({ ...ENV, PORTAIL_ISSUER: undefined })).toBeNull();
    expect(portailClient({ ...ENV, PORTAIL_CLIENT_ID: "" })).toBeNull();
    expect(portailClient({ ...ENV, PORTAIL_CLIENT_SECRET: undefined })).toBeNull();
  });

  it("derives the link to the portal from the issuer", () => {
    expect(portailHomeUrl(ENV)).toBe("https://portail.example.test");
    expect(portailHomeUrl({})).toBeNull();
    expect(portailHomeUrl({ PORTAIL_ISSUER: "pas une adresse" })).toBeNull();
  });
});

describe("the roles declared to the portal (D1)", () => {
  it("are written exactly as it sends them", () => {
    expect(ROLES).toEqual(["player", "admin"]);
    expect(isRole("admin")).toBe(true);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("the portal's address (D16)", () => {
  it("is never written in the code: it stays a variable", () => {
    const offenders = filesOf("src").filter((file) => /portail-admission|\.vercel\.app/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

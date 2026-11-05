import { describe, expect, it } from "vitest";
import { isOpenAuthPath, isPortailCallbackPath, isPortailFlowPath } from "@/lib/auth/http-paths";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("pages reachable without a session (§6.4)", () => {
  it.each(["/connexion", "/api/auth/sign-in/social", "/api/auth/callback/portail", "/api/health", "/api/chat"])("%s is public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/inscription", "/profil", "/admin", "/admin/joueurs", "/connexions", "/api/autre", "/inscription-bis", "/chat", "/api/chats"])(
    "%s needs a session",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("Better Auth routes open over HTTP (decision of 30/09/2026)", () => {
  it("opens the two routes of the flow and the session", () => {
    expect(isOpenAuthPath("/api/auth/sign-in/social")).toBe(true);
    expect(isOpenAuthPath("/api/auth/callback/portail")).toBe(true);
    expect(isOpenAuthPath("/api/auth/get-session")).toBe(true);
  });

  it("closes the password routes (G9)", () => {
    for (const path of ["/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/auth/change-password"]) {
      expect(isOpenAuthPath(path), path).toBe(false);
    }
  });

  it("closes the return address of any other provider", () => {
    expect(isOpenAuthPath("/api/auth/callback/google")).toBe(false);
  });

  it("tells the flow, which needs the portal, from the rest", () => {
    expect(isPortailFlowPath("/api/auth/sign-in/social")).toBe(true);
    expect(isPortailFlowPath("/api/auth/callback/portail")).toBe(true);
    expect(isPortailFlowPath("/api/auth/get-session")).toBe(false);
    expect(isPortailCallbackPath("/api/auth/callback/portail")).toBe(true);
    expect(isPortailCallbackPath("/api/auth/sign-in/social")).toBe(false);
  });

  it("closes the admin routes and the user update, which would bypass the services' rules", () => {
    for (const path of [
      "/api/auth/admin/set-role",
      "/api/auth/admin/remove-user",
      "/api/auth/admin/create-user",
      "/api/auth/admin/set-user-password",
      "/api/auth/update-user",
      "/api/auth/delete-user",
      "/api/auth/change-email",
      "/api/auth/sign-in/social/",
      "/api/auth",
      "/sign-in/social",
    ]) {
      expect(isOpenAuthPath(path), path).toBe(false);
    }
  });
});

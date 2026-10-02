import { describe, expect, it } from "vitest";
import { signInError, signUpError } from "@/lib/auth/auth-errors";
import { isOpenAuthPath } from "@/lib/auth/http-paths";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("pages reachable without a session (§6.4)", () => {
  it.each(["/connexion", "/inscription", "/api/auth/sign-in/email", "/api/health", "/api/chat"])("%s is public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/profil", "/admin", "/admin/joueurs", "/connexions", "/api/autre", "/inscription-bis", "/chat", "/api/chats"])(
    "%s needs a session",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("Better Auth routes open over HTTP (decision of 30/09/2026)", () => {
  it("opens sign-in, sign-up and the session", () => {
    expect(isOpenAuthPath("/api/auth/sign-in/email")).toBe(true);
    expect(isOpenAuthPath("/api/auth/sign-up/email")).toBe(true);
    expect(isOpenAuthPath("/api/auth/get-session")).toBe(true);
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
      "/api/auth/sign-in/email/",
      "/api/auth",
      "/sign-in/email",
    ]) {
      expect(isOpenAuthPath(path), path).toBe(false);
    }
  });
});

describe("French messages of the sign-in and sign-up forms (§8.3)", () => {
  it("sign-in", () => {
    expect(signInError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toEqual({ message: "Email ou mot de passe incorrect." });
    expect(signInError({ status: 400, code: "INVALID_EMAIL" })).toEqual({ message: "Email ou mot de passe incorrect." });
    expect(signInError({ status: 429 })).toEqual({ message: "Trop de tentatives. Réessaie dans une minute." });
    expect(signInError({ status: 403, code: "BANNED_USER" })).toEqual({ message: "Ton compte est désactivé. Contacte l'admin." });
    expect(signInError({ status: 500 })).toEqual({ message: "Une erreur est survenue. Réessaie." });
  });

  it("sign-up", () => {
    expect(signUpError({ status: 400, code: "EMAIL_NOT_ALLOWED", message: "Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin." })).toEqual({
      field: "email",
      message: "Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin.",
    });
    expect(signUpError({ status: 400, code: "NAME_TAKEN", message: "Ce nom est déjà pris." })).toEqual({
      field: "name",
      message: "Ce nom est déjà pris.",
    });
    expect(signUpError({ status: 400, code: "PASSWORD_TOO_SHORT", message: "Password too short" })).toEqual({
      field: "password",
      message: "Le mot de passe doit faire de 8 à 128 caractères.",
    });
    expect(signUpError({ status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toEqual({
      field: "email",
      message: "Un compte existe déjà avec cette adresse. Connecte-toi.",
    });
    expect(signUpError({ status: 429 })).toEqual({ message: "Trop de tentatives. Réessaie dans quelques minutes." });
    expect(signUpError({ status: 500, message: "Internal" })).toEqual({ message: "Une erreur est survenue. Réessaie." });
  });
});

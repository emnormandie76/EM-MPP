import { createHash, generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

// A fake OIDC provider that follows contract v1 of the portal (architecture §9.2): the real one is
// never reached by a test (D8, G18). Integration tests drive it directly; the end-to-end tests run it
// as a server (e2e/fake-portail-server.ts) and drive it over HTTP (`/__test/state`).

export const FAKE_CLIENT_ID = "client-de-test";
export const FAKE_CLIENT_SECRET = "secret-de-test";

export type PortailIdentity = { sub: string; email: string; name: string; role: string };

/** How the provider lies, to prove that each check of the contract refuses. */
export type TokenTweaks = {
  issuer?: string;
  audience?: string;
  nonce?: string;
  /** Seconds, negative for a token that has already expired. */
  expiresIn?: number;
  badSignature?: boolean;
  omitIdToken?: boolean;
};

export type FakePortailState = {
  /** The person signed in on the portal; without one, the sign-in page of the portal shows. */
  identity: PortailIdentity | null;
  /** Answer of the authorization endpoint instead of a code, for instance `access_denied`. */
  authorizeError: string | null;
  tweaks: TokenTweaks;
};

export type AuthorizeRecord = Record<string, string>;
export type TokenRecord = { authorization: string | undefined; body: Record<string, string> };
export type LogoutRecord = Record<string, string>;

export type FakePortail = {
  issuer: string;
  origin: string;
  state: FakePortailState;
  authorizeRequests: AuthorizeRecord[];
  tokenRequests: TokenRecord[];
  logoutRequests: LogoutRecord[];
  close(): Promise<void>;
};

type PendingCode = { nonce: string | undefined; challenge: string; redirectUri: string; identity: PortailIdentity };

const API = "/api/auth";
const KEY_ID = "cle-de-test";

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signJwt(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "RS256", kid: KEY_ID, typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  return `${header}.${payload}.${base64url(sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey))}`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { location });
  response.end();
}

export async function startFakePortail(options: { port?: number } = {}): Promise<FakePortail> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey: wrongKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: KEY_ID, use: "sig", alg: "RS256" };

  const state: FakePortailState = { identity: null, authorizeError: null, tweaks: {} };
  const codes = new Map<string, PendingCode>();
  const authorizeRequests: AuthorizeRecord[] = [];
  const tokenRequests: TokenRecord[] = [];
  const logoutRequests: LogoutRecord[] = [];
  let origin = "";
  const issuer = () => `${origin}${API}`;

  function authorize(url: URL, response: ServerResponse): void {
    const params = Object.fromEntries(url.searchParams);
    authorizeRequests.push(params);
    const redirectUri = new URL(params.redirect_uri);
    if (state.authorizeError) {
      redirectUri.searchParams.set("error", state.authorizeError);
      redirectUri.searchParams.set("state", params.state);
      redirect(response, redirectUri.toString());
      return;
    }
    if (!state.identity) {
      // The real portal shows its sign-in page here: the application receives nothing.
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end('<!doctype html><html lang="fr"><title>Portail de test</title><h1>Portail de test</h1></html>');
      return;
    }
    const code = randomUUID();
    codes.set(code, {
      nonce: params.nonce,
      challenge: params.code_challenge,
      redirectUri: params.redirect_uri,
      identity: state.identity,
    });
    redirectUri.searchParams.set("code", code);
    redirectUri.searchParams.set("state", params.state);
    redirect(response, redirectUri.toString());
  }

  async function token(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = Object.fromEntries(new URLSearchParams(await readBody(request)));
    tokenRequests.push({ authorization: request.headers.authorization, body });

    const expected = `Basic ${Buffer.from(`${FAKE_CLIENT_ID}:${FAKE_CLIENT_SECRET}`).toString("base64")}`;
    if (request.headers.authorization !== expected) return json(response, 401, { error: "invalid_client" });

    const pending = codes.get(body.code);
    codes.delete(body.code);
    const challenge = createHash("sha256").update(body.code_verifier ?? "").digest("base64url");
    if (!pending || pending.redirectUri !== body.redirect_uri || pending.challenge !== challenge) {
      return json(response, 400, { error: "invalid_grant" });
    }

    const { tweaks } = state;
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: tweaks.issuer ?? issuer(),
      aud: tweaks.audience ?? FAKE_CLIENT_ID,
      iat: now,
      exp: now + (tweaks.expiresIn ?? 3600),
      nonce: tweaks.nonce ?? pending.nonce,
      ...pending.identity,
    };
    json(response, 200, {
      access_token: `jeton-${pending.identity.sub}`,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid profile email",
      ...(tweaks.omitIdToken ? {} : { id_token: signJwt(tweaks.badSignature ? wrongKey : privateKey, claims) }),
    });
  }

  function endSession(url: URL, response: ServerResponse): void {
    const params = Object.fromEntries(url.searchParams);
    logoutRequests.push(params);
    // The portal closes its own session (contract §3.8).
    state.identity = null;
    if (params.post_logout_redirect_uri) redirect(response, params.post_logout_redirect_uri);
    else json(response, 200, { confirm: true });
  }

  async function testControl(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === "POST") {
      const update = JSON.parse(await readBody(request)) as Partial<FakePortailState>;
      Object.assign(state, { identity: null, authorizeError: null, tweaks: {} }, update);
    }
    json(response, 200, { state, logoutRequests, authorizeCount: authorizeRequests.length });
  }

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", origin);
    switch (url.pathname) {
      case `${API}/.well-known/openid-configuration`:
        return json(response, 200, {
          issuer: issuer(),
          authorization_endpoint: `${issuer()}/oauth2/authorize`,
          token_endpoint: `${issuer()}/oauth2/token`,
          userinfo_endpoint: `${issuer()}/oauth2/userinfo`,
          end_session_endpoint: `${issuer()}/oauth2/end-session`,
          jwks_uri: `${issuer()}/jwks`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
        });
      case `${API}/jwks`:
        return json(response, 200, { keys: [jwk] });
      case `${API}/oauth2/authorize`:
        return authorize(url, response);
      case `${API}/oauth2/token`:
        return token(request, response);
      case `${API}/oauth2/userinfo`:
        return json(response, 200, state.identity ?? {});
      case `${API}/oauth2/end-session`:
        return endSession(url, response);
      case "/__test/state":
        return testControl(request, response);
      default:
        response.writeHead(404);
        response.end();
    }
  }

  const server: Server = createServer((request, response) => {
    // One connection per request. A kept connection is cut after 5 idle seconds: under the load of the
    // whole suite, a slow test outlasts it, and the next fetch fails with ECONNRESET.
    response.setHeader("connection", "close");
    route(request, response).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", resolve);
  });
  // 127.0.0.1, not localhost: on Windows, the name tries ::1 first, and under load that attempt can fail.
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer: issuer(),
    origin,
    state,
    authorizeRequests,
    tokenRequests,
    logoutRequests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

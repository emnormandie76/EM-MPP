"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth/auth-client";
import { PORTAIL_PROVIDER_ID, SIGN_IN_PATH } from "@/lib/auth/portail";

/**
 * Sign-in through the portal, over HTTP, where the attempt limit applies (§6.1, §6.2). With `auto`,
 * the flow starts by itself, once (D20): the tile of the portal leads straight to the game.
 */
export function PortailSignIn({ auto }: { auto: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(auto);
  const started = useRef(false);

  async function start() {
    const failed = () => router.replace(`${SIGN_IN_PATH}?error=portail_unavailable`);
    try {
      const { error } = await authClient.signIn.social({
        provider: PORTAIL_PROVIDER_ID,
        callbackURL: "/",
        errorCallbackURL: SIGN_IN_PATH,
      });
      if (error) failed();
    } catch {
      failed();
    }
  }

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    // Back from the portal, the browser must find the button, not start the flow again.
    window.history.replaceState(null, "", SIGN_IN_PATH);
    void start();
    // `start` only reads the router: this runs once, for the page's first `auto`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <Button
      size="lg"
      pending={pending}
      onClick={() => {
        setPending(true);
        void start();
      }}
    >
      Se connecter avec le portail
    </Button>
  );
}

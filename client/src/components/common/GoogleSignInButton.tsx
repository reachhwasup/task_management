import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleAuth } from "../../api/auth";
import { apiErrorMessage } from "../../api/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string }
          ) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const isGoogleAuthConfigured = !!CLIENT_ID;

export default function GoogleSignInButton({ text = "continue_with" }: { text?: string }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const googleAuth = useGoogleAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    function render() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: async (response) => {
          setError("");
          try {
            await googleAuth.mutateAsync(response.credential);
            navigate("/");
          } catch (err) {
            setError(apiErrorMessage(err, "Google sign-in failed"));
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text,
      });
      clearInterval(interval);
    }

    // The GIS script tag loads async — poll briefly until window.google exists.
    interval = setInterval(() => !cancelled && render(), 100);
    render();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div>
      <div ref={buttonRef} className="flex justify-center" />
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

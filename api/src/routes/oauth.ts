import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// In-memory store for OAuth state and one-time codes (production would use Redis)
const pendingStates = new Map<string, number>(); // state -> timestamp
const pendingCodes = new Map<string, { userId: string; expiresAt: number }>(); // code -> { userId, expiresAt }

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/auth/oauth/google/callback";
  return { clientId, clientSecret, redirectUri };
}

// Cleanup expired entries periodically
function cleanupExpired() {
  const now = Date.now();
  for (const [key, ts] of pendingStates) {
    if (now - ts > 10 * 60 * 1000) pendingStates.delete(key); // 10 min
  }
  for (const [key, val] of pendingCodes) {
    if (now > val.expiresAt) pendingCodes.delete(key);
  }
}

export default async function oauthRoutes(app: FastifyInstance) {
  // Redirect to Google for authorization
  app.get("/api/auth/oauth/google/authorize", async (_req: FastifyRequest, reply: FastifyReply) => {
    const { clientId, redirectUri } = getGoogleConfig();
    if (!clientId) return replyError(reply, 500, "Google OAuth not configured", "OAUTH_NOT_CONFIGURED");

    cleanupExpired();
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, Date.now());

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
    });

    return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // Google callback
  const callbackQuery = z.object({ code: z.string(), state: z.string() });

  app.get("/api/auth/oauth/google/callback", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = callbackQuery.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    if (!parsed.success) return replyError(reply, 400, "Missing code or state parameter", "VALIDATION_ERROR");

    // Validate state (CSRF protection)
    if (!pendingStates.has(parsed.data.state)) {
      return replyError(reply, 400, "Invalid or expired OAuth state", "OAUTH_CSRF");
    }
    pendingStates.delete(parsed.data.state);

    const { clientId, clientSecret, redirectUri } = getGoogleConfig();
    if (!clientId || !clientSecret) {
      return replyError(reply, 500, "Google OAuth not configured", "OAUTH_NOT_CONFIGURED");
    }

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: parsed.data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return replyError(reply, 401, "Failed to exchange code", "OAUTH_ERROR");
    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get user info (includes email_verified)
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return replyError(reply, 401, "Failed to get user info", "OAUTH_ERROR");
    const profile = (await userRes.json()) as { id: string; email: string; name: string; verified_email?: boolean };

    // Require verified email from Google
    if (profile.verified_email === false) {
      return replyError(reply, 403, "Email not verified by Google", "EMAIL_NOT_VERIFIED");
    }

    const db = await getDb();

    // Check if user already linked with this Google ID
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.oauthProvider, "google"), eq(users.oauthId, profile.id)))
      .limit(1);

    let userId: string;
    if (existing) {
      if (!existing.isActive) return replyError(reply, 403, "Account is deactivated", "ACCOUNT_DISABLED");
      userId = existing.id;
    } else {
      // Check if email already exists (link accounts only if verified)
      const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
      if (byEmail) {
        if (!byEmail.isActive) return replyError(reply, 403, "Account is deactivated", "ACCOUNT_DISABLED");
        await db
          .update(users)
          .set({ oauthProvider: "google", oauthId: profile.id })
          .where(eq(users.id, byEmail.id));
        userId = byEmail.id;
      } else {
        // Create new user (random password hash, can't be used for login)
        const placeholderHash = `$oauth$${crypto.randomBytes(32).toString("hex")}`;
        const [newUser] = await db
          .insert(users)
          .values({
            email: profile.email,
            name: profile.name,
            passwordHash: placeholderHash,
            oauthProvider: "google",
            oauthId: profile.id,
          })
          .returning();
        userId = newUser.id;
      }
    }

    // Issue a one-time code instead of putting JWT in URL
    cleanupExpired();
    const code = crypto.randomBytes(32).toString("hex");
    pendingCodes.set(code, { userId, expiresAt: Date.now() + 60_000 }); // 60s expiry

    const webUrl = process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:5001";
    return reply.redirect(`${webUrl}/login?code=${code}`);
  });

  // Exchange one-time code for JWT (called from frontend)
  const exchangeBody = z.object({ code: z.string().min(1) });

  app.post("/api/auth/oauth/exchange", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = exchangeBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) return replyError(reply, 400, "Invalid code", "VALIDATION_ERROR");

    const entry = pendingCodes.get(parsed.data.code);
    if (!entry || Date.now() > entry.expiresAt) {
      pendingCodes.delete(parsed.data.code);
      return replyError(reply, 401, "Invalid or expired code", "INVALID_CODE");
    }
    pendingCodes.delete(parsed.data.code);

    const token = app.jwt.sign({ sub: entry.userId });
    const db = await getDb();
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, entry.userId))
      .limit(1);

    return reply.send({ token, user });
  });
}

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

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/auth/oauth/google/callback";
  return { clientId, clientSecret, redirectUri };
}

export default async function oauthRoutes(app: FastifyInstance) {
  // Redirect to Google for authorization
  app.get("/api/auth/oauth/google/authorize", async (_req: FastifyRequest, reply: FastifyReply) => {
    const { clientId, redirectUri } = getGoogleConfig();
    if (!clientId) return replyError(reply, 500, "Google OAuth not configured", "OAUTH_NOT_CONFIGURED");

    const state = crypto.randomBytes(16).toString("hex");
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
  const callbackQuery = z.object({ code: z.string(), state: z.string().optional() });

  app.get("/api/auth/oauth/google/callback", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = callbackQuery.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    if (!parsed.success) return replyError(reply, 400, "Missing code parameter", "VALIDATION_ERROR");

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

    // Get user info
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) return replyError(reply, 401, "Failed to get user info", "OAUTH_ERROR");
    const profile = (await userRes.json()) as { id: string; email: string; name: string };

    const db = await getDb();

    // Check if user already linked with this Google ID
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.oauthProvider, "google"), eq(users.oauthId, profile.id)))
      .limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      // Check if email already exists (link accounts)
      const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
      if (byEmail) {
        await db
          .update(users)
          .set({ oauthProvider: "google", oauthId: profile.id })
          .where(eq(users.id, byEmail.id));
        userId = byEmail.id;
      } else {
        // Create new user (no password for OAuth users)
        const placeholderHash = crypto.randomBytes(32).toString("hex");
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

    const token = app.jwt.sign({ sub: userId });
    const webUrl = process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:5001";
    return reply.redirect(`${webUrl}/login?token=${token}`);
  });
}

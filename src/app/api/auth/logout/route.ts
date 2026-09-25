import { clearAuthCookie, getSession } from "@/lib/auth";
import { apiSuccess, audit, withErrorHandling } from "@/lib/api";

// POST /api/auth/logout - clear the session cookie.
export async function POST() {
  return withErrorHandling(async () => {
    const session = await getSession();
    await clearAuthCookie();
    if (session) {
      await audit({
        userId: session.userId,
        action: "LOGOUT",
        resource: "auth",
        resourceId: session.userId,
        description: `${session.email} logged out`,
      });
    }
    return apiSuccess({ loggedOut: true });
  });
}

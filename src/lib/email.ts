/**
 * Server-side Email Service Utility
 * 
 * Supports:
 * 1. Resend API (when RESEND_API_KEY is configured in Vercel / .env)
 * 2. Console Dev Preview (graceful fallback when running in dev or without email provider)
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.EMAIL_FROM || "VolkssKatt HR <noreply@volksskatt.com>",
}: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Resend API Integration (Native Fetch, zero-dependency, serverless-safe)
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Resend API error:", data);
        return { success: false, error: data.message || "Failed to send email via Resend" };
      }

      console.log(`[Email] Successfully sent to ${to} (ID: ${data.id})`);
      return { success: true, id: data.id };
    } catch (err: unknown) {
      console.error("Failed to dispatch email via Resend:", err);
      return { success: false, error: String(err) };
    }
  }

  // 2. Local / Development Console Fallback
  console.log("────────────────────────────────────────────────────────────");
  console.log(`✉️  [EMAIL DISPATCH] To: ${to}`);
  console.log(`📌  Subject: ${subject}`);
  console.log(`👤  From: ${from}`);
  console.log("────────────────────────────────────────────────────────────");

  return { success: true, id: "dev-preview-logged" };
}

/**
 * Pre-formatted Email Templates
 */
export const emailTemplates = {
  /**
   * Onboarding / Account Setup Invitation
   */
  onboardingInvitation: ({
    name,
    setupUrl,
  }: {
    name: string;
    setupUrl: string;
  }) => ({
    subject: "Welcome to VolkssKatt — Complete Your Account Setup",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">VolkssKatt EMS</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Employee Management & Training Platform</p>
        </div>
        
        <p style="color: #1e293b; font-size: 16px; line-height: 24px;">Hello <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 22px;">
          Your registration request at VolkssKatt has been approved! Please click the secure button below to set up your password and complete your employee profile.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${setupUrl}" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
            Complete Account Setup →
          </a>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; line-height: 18px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${setupUrl}" style="color: #6366f1; word-break: break-all;">${setupUrl}</a>
        </p>
      </div>
    `,
  }),

  passwordReset: ({
    name,
    resetUrl,
  }: {
    name: string;
    resetUrl: string;
  }) => ({
    subject: "Reset Your VolkssKatt Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">VolkssKatt EMS</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Password Reset Request</p>
        </div>

        <p style="color: #1e293b; font-size: 16px; line-height: 24px;">Hello <strong>${name}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 22px;">
          We received a request to reset your password. Use the button below to choose a new password. This link is valid for 1 hour.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
            Reset Password →
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; line-height: 18px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
    `,
  }),

  /**
   * Leave Application Status Update
   */
  leaveStatusUpdate: ({
    name,
    leaveType,
    status,
    startDate,
    endDate,
  }: {
    name: string;
    leaveType: string;
    status: "approved" | "rejected";
    startDate: string;
    endDate: string;
  }) => ({
    subject: `Leave Request ${status === "approved" ? "Approved ✅" : "Declined ❌"} — VolkssKatt`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h3 style="color: #1e293b; margin-top: 0;">Hello ${name},</h3>
        <p style="color: #475569; font-size: 14px;">
          Your application for <strong>${leaveType}</strong> from <strong>${startDate}</strong> to <strong>${endDate}</strong> has been 
          <strong style="color: ${status === "approved" ? "#16a34a" : "#dc2626"}; text-transform: uppercase;">${status}</strong>.
        </p>
        <p style="color: #64748b; font-size: 13px;">You can view your updated leave balance in your self-service dashboard.</p>
      </div>
    `,
  }),
};

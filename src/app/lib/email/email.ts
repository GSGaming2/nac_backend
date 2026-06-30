import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendVerificationCodeEmail(
  email: string,
  code: string
) {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("Missing RESEND_FROM_EMAIL");
  }

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Verify your NAC account",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
        <h2>Payment Successful 🎉</h2>

        <p>
          Thank you for subscribing to <strong>NAC</strong>.
        </p>

        <p>
          Use the verification code below to complete your registration:
        </p>

        <div
          style="
            font-size:32px;
            font-weight:bold;
            letter-spacing:8px;
            padding:20px;
            background:#f5f5f5;
            text-align:center;
            border-radius:8px;
            margin:30px 0;
          "
        >
          ${code}
        </div>

        <p>
          This verification code expires in
          <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not initiate this request, you can safely ignore this
          email.
        </p>

        <hr />

        <small>
          © ${new Date().getFullYear()} NAC. All rights reserved.
        </small>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
) {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("Missing RESEND_FROM_EMAIL");
  }
  const resetLink =
    `${process.env.FRONTEND_URL}/reset-password?token=${code}`;
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Reset your NAC password",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your NAC account.</p>
        <p>Use the code below to reset your password:</p>
        <div
          style="
            font-size:32px;
            font-weight:bold;
            letter-spacing:8px;
            padding:20px;
            background:#f5f5f5;
            text-align:center;
            border-radius:8px;
            margin:30px 0;
          "
        >
          <a href="${resetLink}">${resetLink}</a>
        </div>
        <p>
          This code expires in <strong>15 minutes</strong>.
        </p>
        <p>
          If you did not request this, you can safely ignore this email.
        </p>
        <hr />
        <small>© ${new Date().getFullYear()} NAC. All rights reserved.</small>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
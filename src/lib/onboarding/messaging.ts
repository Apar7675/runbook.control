type SendEmailArgs = {
  email: string;
  code?: string;
  fullName?: string | null;
};

type SendSmsArgs = {
  phone: string;
  code?: string;
};

type VerifyEmailArgs = {
  email: string;
  code: string;
};

type VerifySmsArgs = {
  phone: string;
  code: string;
};

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

function twilioVerifyConfig() {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const serviceSid = env("TWILIO_VERIFY_SERVICE_SID");
  return { accountSid, authToken, serviceSid };
}

export function isTwilioVerifyConfigured() {
  const { accountSid, authToken, serviceSid } = twilioVerifyConfig();
  return Boolean(accountSid && authToken && serviceSid);
}

async function postTwilioVerify(path: string, form: URLSearchParams) {
  const { accountSid, authToken, serviceSid } = twilioVerifyConfig();
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify is not configured.");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? `Twilio Verify failed (${response.status}).`);
  }

  return payload;
}

async function sendTwilioVerification(to: string, channel: "email" | "sms") {
  const payload = await postTwilioVerify(
    "Verifications",
    new URLSearchParams({
      To: to,
      Channel: channel,
    })
  );

  return {
    ok: true as const,
    delivery: channel === "sms" ? "twilio_verify_sms" : "twilio_verify_email",
    masked: channel === "sms" ? maskPhone(to) : to.replace(/(^.).+(@.*$)/, "$1***$2"),
    provider_status: payload?.status ?? "",
    provider_message_sid: payload?.sid ?? "",
  };
}

async function checkTwilioVerification(to: string, code: string) {
  const payload = await postTwilioVerify(
    "VerificationCheck",
    new URLSearchParams({
      To: to,
      Code: code,
    })
  );

  return {
    ok: payload?.status === "approved",
    status: payload?.status ?? "",
  };
}

export async function sendOnboardingEmailCode(args: SendEmailArgs) {
  const maskedEmail = args.email.replace(/(^.).+(@.*$)/, "$1***$2");
  if (isTwilioVerifyConfigured()) {
    return sendTwilioVerification(args.email, "email");
  }

  if (!args.code) throw new Error("Email verification code is required.");

  const resendApiKey = env("RESEND_API_KEY");
  const fromEmail = env("RUNBOOK_ONBOARDING_EMAIL_FROM") || env("RUNBOOK_EMAIL_FROM");

  if (!resendApiKey || !fromEmail) {
    throw new Error("Email verification is not configured. Add TWILIO_VERIFY_SERVICE_SID with TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or configure RESEND_API_KEY and RUNBOOK_ONBOARDING_EMAIL_FROM.");
  }

  const name = (args.fullName ?? "").trim();
  const subject = "Your RunBook verification code";
  const text = [
    name ? `Hi ${name},` : "Hi,",
    "",
    `Your RunBook verification code is ${args.code}.`,
    "It expires in 10 minutes.",
    "",
    "If you did not request this code, you can ignore this email.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: args.email,
      subject,
      text,
    }),
  });

  const body = await response.text();
  let payload: any = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? `Email verification send failed (${response.status}).`);
  }

  return {
    ok: true as const,
    delivery: "resend_email",
    masked: maskedEmail,
    provider_message_id: payload?.id ?? "",
  };
}

export async function sendOnboardingSmsCode(args: SendSmsArgs) {
  const maskedPhone = maskPhone(args.phone);
  if (isTwilioVerifyConfigured()) {
    return sendTwilioVerification(args.phone, "sms");
  }

  if (!args.code) throw new Error("SMS verification code is required.");

  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");
  const fromNumber = env("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    throw new Error("Twilio SMS is not configured. Add TWILIO_VERIFY_SERVICE_SID with TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or configure TWILIO_MESSAGING_SERVICE_SID/TWILIO_FROM_NUMBER.");
  }

  const body = `Your RunBook verification code is ${args.code}. It expires in 10 minutes.`;
  const form = new URLSearchParams({
    To: args.phone,
    Body: body,
  });

  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else {
    form.set("From", fromNumber);
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? `Twilio SMS failed (${response.status}).`);
  }

  return {
    ok: true as const,
    delivery: "twilio_sms",
    masked: maskedPhone,
    provider_status: payload?.status ?? "",
    provider_message_sid: payload?.sid ?? "",
  };
}

export async function verifyOnboardingEmailCode(args: VerifyEmailArgs) {
  return checkTwilioVerification(args.email, args.code);
}

export async function verifyOnboardingSmsCode(args: VerifySmsArgs) {
  return checkTwilioVerification(args.phone, args.code);
}

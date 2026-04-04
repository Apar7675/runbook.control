type SendEmailArgs = {
  email: string;
  code: string;
  fullName?: string | null;
};

type SendSmsArgs = {
  phone: string;
  code: string;
};

function maybeExposeCode(code: string) {
  return process.env.NODE_ENV !== "production" || process.env.RUNBOOK_ONBOARDING_EXPOSE_CODES === "1"
    ? { dev_code: code }
    : {};
}

export async function sendOnboardingEmailCode(args: SendEmailArgs) {
  const maskedEmail = args.email.replace(/(^.).+(@.*$)/, "$1***$2");
  console.info(`[onboarding-email-code] ${maskedEmail} -> ${args.code}`);
  return {
    ok: true as const,
    delivery: "stub_email",
    masked: maskedEmail,
    ...maybeExposeCode(args.code),
  };
}

export async function sendOnboardingSmsCode(args: SendSmsArgs) {
  const digits = args.phone.replace(/\D/g, "");
  const maskedPhone = digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
  console.info(`[onboarding-sms-code] ${maskedPhone} -> ${args.code}`);
  return {
    ok: true as const,
    delivery: "stub_sms",
    masked: maskedPhone,
    ...maybeExposeCode(args.code),
  };
}

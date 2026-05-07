const blockedEmailDomains = new Set([
  "example.com",
  "example.org",
  "example.net",
  "invalid.com",
  "localhost",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com"
]);

export function normalizeLeadEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function validateLeadEmail(value: unknown) {
  const email = normalizeLeadEmail(value);

  if (!email || email.length > 254 || /\s/.test(email)) {
    return { email, ok: false };
  }

  const [localPart, domain, extra] = email.split("@");

  if (
    extra !== undefined ||
    !localPart ||
    !domain ||
    localPart.length > 64 ||
    email.includes("..") ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    blockedEmailDomains.has(domain)
  ) {
    return { email, ok: false };
  }

  const labels = domain.split(".");
  const tld = labels.at(-1) ?? "";
  const validLabels = labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );

  if (
    labels.length < 2 ||
    !validLabels ||
    !/^[a-z]{2,24}$/.test(tld) ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
  ) {
    return { email, ok: false };
  }

  return { email, ok: true };
}

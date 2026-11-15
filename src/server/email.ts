import "server-only"

/**
 * Farm For You's email, sent through Brevo (free: 300 emails a day). Set BREVO_API_KEY and EMAIL_FROM (a sender
 * address verified in Brevo); EMAIL_FROM_NAME is optional. Used for customers' sign-in codes.
 */
export function emailReady() {
  return !!process.env.BREVO_API_KEY && !!process.env.EMAIL_FROM
}

export type Mail = { to: string; subject: string; text: string; html: string }
type Sender = (m: Mail) => Promise<void>

const brevo: Sender = async (m) => {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY ?? "", "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "Farm For You" },
      to: [{ email: m.to }],
      subject: m.subject,
      textContent: m.text,
      htmlContent: m.html,
    }),
  })
  if (!res.ok) throw new Error(`brevo ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

let sender: Sender = brevo

export function sendEmail(m: Mail) {
  return sender(m)
}

export function setEmailSenderForTests(s: Sender | null) {
  sender = s ?? brevo
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/** The sign-in code email, Tamil first, then English. */
export function signInCodeMail(to: string, code: string, farm: { ta: string; en: string }): Mail {
  const subject = `${code} — ${farm.en} sign-in code / உள்நுழைவுக் குறியீடு`
  const text =
    `${farm.ta}: உங்கள் உள்நுழைவுக் குறியீடு ${code}. 5 நிமிடத்தில் காலாவதியாகும். நீங்கள் கேட்கவில்லை என்றால் இதை விட்டுவிடுங்கள்.\n\n` +
    `${farm.en}: your sign-in code is ${code}. It runs out in 5 minutes. If you didn't ask for it, ignore this email.\n\n— Farm For You`
  const html =
    `<div style="font-family:sans-serif;font-size:16px;line-height:1.5">` +
    `<p>${esc(farm.ta)}: உங்கள் உள்நுழைவுக் குறியீடு</p>` +
    `<p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p>` +
    `<p>5 நிமிடத்தில் காலாவதியாகும். நீங்கள் கேட்கவில்லை என்றால் இதை விட்டுவிடுங்கள்.</p><hr>` +
    `<p>${esc(farm.en)}: your sign-in code is <b>${code}</b>. It runs out in 5 minutes. If you didn't ask for it, ignore this email.</p>` +
    `<p style="color:#666">— Farm For You</p></div>`
  return { to, subject, text, html }
}

type RenderedEmail = {
  subject: string
  html: string
  text: string
}

export function emailVerificationTemplate(opts: {
  recipientName: string
  verifyUrl: string
}): RenderedEmail {
  const subject = 'Подтвердите email — Scrumban'
  const text = `Привет${opts.recipientName ? `, ${opts.recipientName}` : ''}!

Подтвердите ваш email, перейдя по ссылке:
${opts.verifyUrl}

Ссылка действует 24 часа. Если вы не регистрировались — проигнорируйте это письмо.`

  const html = baseTemplate({
    preheader: 'Подтвердите ваш email-адрес для Scrumban',
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Подтвердите ваш email
      </h1>
      <p style="margin:0 0 24px;color:#4b5563;">
        Привет${opts.recipientName ? `, ${escapeHtml(opts.recipientName)}` : ''}!
        Спасибо за регистрацию в Scrumban. Чтобы продолжить, подтвердите свой email-адрес.
      </p>
      ${ctaButton('Подтвердить email', opts.verifyUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
        Или скопируйте ссылку в браузер:<br>
        <span style="word-break:break-all;color:#6366f1;">${escapeHtml(opts.verifyUrl)}</span>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        Ссылка действует 24 часа. Если вы не регистрировались — проигнорируйте это письмо.
      </p>
    `,
  })
  return { subject, html, text }
}

export function passwordResetTemplate(opts: {
  recipientName: string
  resetUrl: string
}): RenderedEmail {
  const subject = 'Сброс пароля — Scrumban'
  const text = `Привет${opts.recipientName ? `, ${opts.recipientName}` : ''}!

Кто-то запросил сброс пароля для вашего аккаунта в Scrumban.
Если это были вы — установите новый пароль по ссылке:
${opts.resetUrl}

Ссылка действует 1 час. Если это были не вы — просто проигнорируйте письмо, ваш пароль не изменится.`

  const html = baseTemplate({
    preheader: 'Установите новый пароль для Scrumban',
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Сброс пароля
      </h1>
      <p style="margin:0 0 24px;color:#4b5563;">
        Привет${opts.recipientName ? `, ${escapeHtml(opts.recipientName)}` : ''}!
        Кто-то запросил сброс пароля для вашего аккаунта. Если это были вы —
        установите новый пароль по кнопке ниже.
      </p>
      ${ctaButton('Установить новый пароль', opts.resetUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
        Или скопируйте ссылку в браузер:<br>
        <span style="word-break:break-all;color:#6366f1;">${escapeHtml(opts.resetUrl)}</span>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        Ссылка действует 1 час. Если вы не запрашивали сброс — просто проигнорируйте письмо.
      </p>
    `,
  })
  return { subject, html, text }
}

export function workspaceInvitationTemplate(opts: {
  workspaceName: string
  inviterName: string
  role: string
  acceptUrl: string
}): RenderedEmail {
  const subject = `Приглашение в ${opts.workspaceName} — Scrumban`
  const text = `${opts.inviterName ? opts.inviterName + ' приглашает' : 'Вас приглашают'} присоединиться к workspace «${opts.workspaceName}» в Scrumban в роли ${opts.role}.

Перейдите по ссылке, чтобы принять приглашение:
${opts.acceptUrl}

Ссылка действует 7 дней.`

  const html = baseTemplate({
    preheader: `Приглашение в workspace ${opts.workspaceName}`,
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Приглашение в workspace
      </h1>
      <p style="margin:0 0 24px;color:#4b5563;">
        ${opts.inviterName ? escapeHtml(opts.inviterName) + ' приглашает' : 'Вас приглашают'}
        присоединиться к workspace <strong>${escapeHtml(opts.workspaceName)}</strong>
        в Scrumban в роли <strong>${escapeHtml(opts.role)}</strong>.
      </p>
      ${ctaButton('Принять приглашение', opts.acceptUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
        Или скопируйте ссылку в браузер:<br>
        <span style="word-break:break-all;color:#6366f1;">${escapeHtml(opts.acceptUrl)}</span>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        Ссылка действует 7 дней. Если приглашение было отправлено по ошибке — просто проигнорируйте письмо.
      </p>
    `,
  })
  return { subject, html, text }
}

function baseTemplate(opts: { preheader: string, body: string }): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Scrumban</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
    ${escapeHtml(opts.preheader)}
  </span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;padding:40px;">
          <tr><td>
            <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:32px;">Scrumban</div>
            ${opts.body}
          </td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
          Scrumban · takt34.tech
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}"
    style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;
    padding:12px 24px;border-radius:10px;font-weight:600;font-size:15px;">
    ${escapeHtml(label)}
  </a>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

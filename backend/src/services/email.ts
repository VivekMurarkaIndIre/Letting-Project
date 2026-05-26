import { google } from 'googleapis';
import { Invitation, Lead, ViewingSlot } from '../models/schemas';
import { db } from './firebase';
import { getAuthenticatedClient } from './googleAuth';

const INVITE_BASE_URL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite`;

async function getAdminTokens(): Promise<any | null> {
  const doc = await db.collection('admin').doc('tokens').get();
  if (!doc.exists) {
    console.warn('[email] No admin tokens found — skipping email');
    return null;
  }
  return doc.data();
}

async function encodeEmail(options: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): Promise<string> {
  const message = [
    `From: "Lette Property" <${options.from}>`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    options.html,
  ].join('\n');
  return Buffer.from(message).toString('base64url');
}

function baseTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lette Property</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#1a2744;padding:24px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:2px;">LETTE</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#333333;font-size:16px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:13px;color:#888888;">Lette Property Management</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInvitationEmail(invitation: Invitation, slot: ViewingSlot): Promise<void> {
  const tokens = await getAdminTokens();
  if (!tokens) return;

  try {
    const client = getAuthenticatedClient(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const adminEmail = data.email;

    const messageHtml = invitation.message.replace(/\n/g, '<br />');
    const acceptUrl = `${INVITE_BASE_URL}/${invitation.id}`;

    const body = `
      <p>${messageHtml}</p>
      <div style="margin:32px 0;text-align:center;">
        <a href="${acceptUrl}"
           style="display:inline-block;background-color:#1a2744;color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:4px;font-size:16px;font-family:sans-serif;">
          Accept Invitation
        </a>
      </div>
    `;

    const gmail = google.gmail({ version: 'v1', auth: client });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: await encodeEmail({
          to: invitation.lead.email,
          from: adminEmail!,
          subject: `You're invited to view ${slot.propertyAddress}`,
          html: baseTemplate(body),
        }),
      },
    });

    console.log(`[email] Sent invitation to ${invitation.lead.email} from ${adminEmail}`);
  } catch (err: any) {
    console.error(`[email] Failed to send invitation to ${invitation.lead.email}:`, err.message);
  }
}

export async function sendSlotFullEmail(lead: Lead, alternativeSlots: ViewingSlot[]): Promise<void> {
  const tokens = await getAdminTokens();
  if (!tokens) return;

  try {
    const client = getAuthenticatedClient(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const adminEmail = data.email;

    const altList = alternativeSlots.length > 0
      ? `<p>Here are other available times at the same property:</p>
         <ul style="padding-left:20px;">
           ${alternativeSlots.map(s =>
             `<li>${s.date} at ${s.time} (${s.duration} min)</li>`
           ).join('')}
         </ul>
         <p>Please reply to this email to request one of these alternative slots.</p>`
      : `<p>Unfortunately there are no other available slots at this property right now. We will be in touch when new times open up.</p>`;

    const body = `
      <p>Dear ${lead.name},</p>
      <p>Unfortunately the viewing slot you were invited to has now been filled by another applicant.</p>
      ${altList}
      <p>We apologise for any inconvenience.</p>
    `;

    const gmail = google.gmail({ version: 'v1', auth: client });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: await encodeEmail({
          to: lead.email,
          from: adminEmail!,
          subject: 'Viewing slot update — alternative times available',
          html: baseTemplate(body),
        }),
      },
    });

    console.log(`[email] Sent slot-full email to ${lead.email} from ${adminEmail}`);
  } catch (err: any) {
    console.error(`[email] Failed to send slot-full email to ${lead.email}:`, err.message);
  }
}

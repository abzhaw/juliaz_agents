/**
 * Lob.com client — sends real, physical printed letters by mail.
 *
 * Setup (add to .env when ready):
 *   LOB_API_KEY=test_xxxx          ← Lob API key (test_ prefix for sandbox)
 *   JULIA_NAME=Julia
 *   JULIA_ADDRESS_LINE1=123 Main St
 *   JULIA_ADDRESS_LINE2=Apt 4       ← optional
 *   JULIA_ADDRESS_CITY=Springfield
 *   JULIA_ADDRESS_STATE=IL
 *   JULIA_ADDRESS_ZIP=62701
 *   JULIA_ADDRESS_COUNTRY=US        ← defaults to US
 *
 *   RAPHAEL_NAME=Raphael
 *   RAPHAEL_ADDRESS_LINE1=456 Oak Ave
 *   RAPHAEL_ADDRESS_CITY=Chicago
 *   RAPHAEL_ADDRESS_STATE=IL
 *   RAPHAEL_ADDRESS_ZIP=60601
 *
 * When LOB_API_KEY or address fields are missing, the letter is saved
 * as DRAFT in the DB — ready to send once configured.
 */

export interface SendResult {
    sent: boolean;
    lobId?: string;
    reason?: string;  // why it wasn't sent (missing config, etc.)
}

function isConfigured(): boolean {
    return !!(
        process.env.LOB_API_KEY &&
        process.env.JULIA_ADDRESS_LINE1 &&
        process.env.JULIA_ADDRESS_CITY &&
        process.env.JULIA_ADDRESS_STATE &&
        process.env.JULIA_ADDRESS_ZIP &&
        process.env.RAPHAEL_ADDRESS_LINE1 &&
        process.env.RAPHAEL_ADDRESS_CITY &&
        process.env.RAPHAEL_ADDRESS_STATE &&
        process.env.RAPHAEL_ADDRESS_ZIP
    );
}

function letterHtml(text: string, date: string): string {
    // Simple, clean letter layout Lob will print
    const lines = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = lines.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
    return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Georgia, serif; font-size: 14pt; line-height: 1.7; color: #222; margin: 60px 80px; }
  .date { color: #666; font-size: 12pt; margin-bottom: 2em; }
  p { margin-bottom: 1.2em; }
</style>
</head>
<body>
<div class="date">${date}</div>
${paragraphs}
</body>
</html>`;
}

export async function sendLetter(letterText: string): Promise<SendResult> {
    if (!isConfigured()) {
        return {
            sent: false,
            reason: 'Lob not configured — letter saved as DRAFT. Add LOB_API_KEY and address env vars to send physically.'
        };
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const body = {
        description: `Daily letter — ${today}`,
        to: {
            name: process.env.JULIA_NAME ?? 'Julia',
            address_line1: process.env.JULIA_ADDRESS_LINE1,
            address_line2: process.env.JULIA_ADDRESS_LINE2 ?? undefined,
            address_city: process.env.JULIA_ADDRESS_CITY,
            address_state: process.env.JULIA_ADDRESS_STATE,
            address_zip: process.env.JULIA_ADDRESS_ZIP,
            address_country: process.env.JULIA_ADDRESS_COUNTRY ?? 'US'
        },
        from: {
            name: process.env.RAPHAEL_NAME ?? 'Raphael',
            address_line1: process.env.RAPHAEL_ADDRESS_LINE1,
            address_city: process.env.RAPHAEL_ADDRESS_CITY,
            address_state: process.env.RAPHAEL_ADDRESS_STATE,
            address_zip: process.env.RAPHAEL_ADDRESS_ZIP,
            address_country: process.env.RAPHAEL_ADDRESS_COUNTRY ?? 'US'
        },
        file: letterHtml(letterText, today),
        color: false,
        double_sided: false
    };

    // Remove undefined fields from nested objects
    (Object.keys(body.to) as (keyof typeof body.to)[]).forEach(k => body.to[k] === undefined && delete body.to[k]);

    const credentials = Buffer.from(`${process.env.LOB_API_KEY}:`).toString('base64');
    const res = await fetch('https://api.lob.com/v1/letters', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        return { sent: false, reason: `Lob API error: ${res.status} — ${err}` };
    }

    const data = await res.json() as { id: string };
    return { sent: true, lobId: data.id };
}

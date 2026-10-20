import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.SOS_TEST_EMAIL,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });
    }
    return transporter;
}

/**
 * Route email recipient based on crisis type
 * medical/accident → EMAIL_MEDICAL
 * fire             → EMAIL_FIRE
 * everything else  → EMAIL_DEFAULT
 */
export function getRecipientByCrisis(crisisType) {
    const t = (crisisType || '').toLowerCase();
    if (t === 'medical' || t === 'accident') return process.env.EMAIL_MEDICAL || process.env.EMAIL_DEFAULT;
    if (t === 'fire') return process.env.EMAIL_FIRE || process.env.EMAIL_DEFAULT;
    return process.env.EMAIL_DEFAULT || process.env.SOS_TEST_EMAIL;
}

export async function sendGuardianSOSAlertEmails({
    guardians = [],
    wardName,
    crisisType,
    address,
    latitude,
    longitude,
    sosId
}) {
    const recipients = (guardians || [])
        .map(g => g?.email)
        .filter(Boolean);

    if (recipients.length === 0) return { sent: 0 };

    const t = (crisisType || 'emergency').toLowerCase();
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
    const appLink = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/sos/${sosId}` : null;

    const subject = `SOS Alert: ${wardName || 'Your ward'} reported ${t}`;
    const text = [
        `SOS Alert`,
        wardName ? `Ward: ${wardName}` : null,
        `Type: ${t}`,
        address ? `Address: ${address}` : null,
        `Location: ${latitude}, ${longitude}`,
        `Maps: ${mapsLink}`,
        appLink ? `Open in app: ${appLink}` : null,
    ].filter(Boolean).join('\n');

    const transporter = getTransporter();

    await transporter.sendMail({
        from: process.env.SOS_TEST_EMAIL,
        to: recipients.join(','),
        subject,
        text
    });

    return { sent: recipients.length };
}

const CRISIS_META = {
    medical:          { emoji: '🚑', color: '#dc2626', label: 'Medical Emergency' },
    fire:             { emoji: '🔥', color: '#ea580c', label: 'Fire Emergency' },
    crime:            { emoji: '🚔', color: '#7c3aed', label: 'Crime / Threat' },
    natural_disaster: { emoji: '⛈️', color: '#0369a1', label: 'Natural Disaster' },
    accident:         { emoji: '🚗', color: '#b45309', label: 'Road Accident' },
    other:            { emoji: '🆘', color: '#374151', label: 'Emergency' },
};

function getMeta(crisisType) {
    return CRISIS_META[(crisisType || '').toLowerCase()] || CRISIS_META.other;
}

function buildHtml({ emoji, color, label, title, bodyRows, steps, emergencyNumbers, footer }) {
    const stepsHtml = steps?.length
        ? `<h2 style="color:#333;font-size:18px;margin:25px 0 15px;border-bottom:2px solid #eee;padding-bottom:10px;">Immediate Actions Required</h2>
           <ol style="margin:0 0 25px;padding-left:20px;color:#333;line-height:1.8;font-size:14px;">${steps.map(s => `<li style="margin-bottom:8px;">${s}</li>`).join('')}</ol>`
        : '';

    const rowsHtml = bodyRows.map(([k, v]) => `
        <tr>
          <td style="width:140px;color:#666;font-size:14px;padding:8px 0;"><strong>${k}:</strong></td>
          <td style="color:#333;font-size:14px;padding:8px 0;">${v}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:${color};padding:30px 20px;text-align:center;">
<div style="font-size:48px;margin-bottom:10px;">${emoji}</div>
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">${title}</h1>
<p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">${label}</p>
</td></tr>

<!-- Content -->
<tr><td style="padding:30px 20px;">

<h2 style="color:#333;font-size:18px;margin:0 0 20px;border-bottom:2px solid #eee;padding-bottom:10px;">Emergency Details</h2>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:25px;">
${rowsHtml}
</table>

${stepsHtml}

<!-- Emergency Numbers -->
<div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:15px;">
<p style="margin:0 0 10px;color:#1565c0;font-size:14px;font-weight:bold;">Emergency Contact Numbers (India)</p>
<table width="100%" cellpadding="4" cellspacing="0">
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚑 Ambulance</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>102 / 108</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚒 Fire Brigade</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>101</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🚔 Police</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>100</strong></td>
</tr>
<tr>
<td style="color:#333;font-size:13px;padding:4px 0;">🆘 Emergency Services</td>
<td style="color:#333;font-size:13px;padding:4px 0;text-align:right;"><strong>112</strong></td>
</tr>
</table>
</div>

</td></tr>

<!-- Footer -->
<tr><td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0;">
<p style="margin:0 0 5px;color:#666;font-size:12px;">Raksha Setu Emergency Response System</p>
<p style="margin:0;color:#999;font-size:11px;">${footer}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Send SOS alert — routed by crisis type
 */
export const sendSOSAlert = async ({ broadcasterName, crisisType, address, latitude, longitude, guidance, medicalHistory }) => {
    const meta = getMeta(crisisType);
    const recipient = getRecipientByCrisis(crisisType);
    if (!recipient) { console.warn('[Email] No recipient configured'); return false; }

    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
    const medRows = medicalHistory ? [
        ['Blood Type', medicalHistory.bloodType || 'Unknown'],
        ['Allergies', medicalHistory.allergies?.join(', ') || 'None'],
        ['Medications', medicalHistory.medications?.join(', ') || 'None'],
        ['Conditions', medicalHistory.conditions?.join(', ') || 'None'],
        ['Notes', medicalHistory.emergencyNotes || '—'],
    ] : [];

    const html = buildHtml({
        ...meta,
        title: `SOS ALERT — ${meta.label}`,
        bodyRows: [
            ['Person', broadcasterName || 'Unknown'],
            ['Crisis Type', meta.label],
            ['Address', address || 'Coordinates shared'],
            ['Coordinates', `${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}`],
            ['Maps', `<a href="${mapsLink}" style="color:#2563eb;">Open in Google Maps →</a>`],
            ...medRows,
        ],
        steps: guidance?.steps || [],
        footer: `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
    });

    try {
        await getTransporter().sendMail({
            from: `"Raksha Setu Emergency" <${process.env.SOS_TEST_EMAIL}>`,
            to: recipient,
            subject: `${meta.emoji} SOS ALERT — ${meta.label} | ${broadcasterName || 'User'} needs help`,
            html
        });
        console.log(`[Email] SOS alert (${crisisType}) sent to ${recipient}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send SOS alert:', err.message);
        return false;
    }
};

/**
 * Send AI accident/emergency detection alert — routed by detected crisis type
 * crisisType is parsed from the AI response
 */
export const sendAIDetectionAlert = async ({ analysisResult, crisisType, intensity, flag, latitude, longitude, modelUsed }) => {
    const meta = getMeta(crisisType || 'other');
    const recipient = getRecipientByCrisis(crisisType);
    if (!recipient) return false;

    const mapsLink = latitude && longitude ? `https://maps.google.com/?q=${latitude},${longitude}` : null;

    const html = buildHtml({
        ...meta,
        title: `AI DETECTED — ${meta.label}`,
        bodyRows: [
            ['Detected By', `AI Safety Monitor (${modelUsed || 'AI'})`],
            ['Crisis Type', meta.label],
            ['Flag', flag || 'Emergency'],
            ['Intensity', intensity ? `${intensity}/100` : 'High'],
            ['Analysis', analysisResult?.slice(0, 300) + (analysisResult?.length > 300 ? '...' : '')],
            ...(mapsLink ? [['Location', `<a href="${mapsLink}" style="color:#2563eb;">Open in Google Maps →</a>`]] : []),
            ...(latitude ? [['Coordinates', `${parseFloat(latitude).toFixed(5)}, ${parseFloat(longitude).toFixed(5)}`]] : []),
        ],
        steps: [],
        footer: `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
    });

    try {
        await getTransporter().sendMail({
            from: `"Raksha Setu AI Monitor" <${process.env.SOS_TEST_EMAIL}>`,
            to: recipient,
            subject: `${meta.emoji} AI DETECTED — ${meta.label} (Intensity: ${intensity || '?'}/100)`,
            html
        });
        console.log(`[Email] AI detection alert (${crisisType}) sent to ${recipient}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send AI detection alert:', err.message);
        return false;
    }
};

// api/monitor.js
import nodemailer from 'nodemailer';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM; // La tua email
const EMAIL_TO = process.env.EMAIL_TO; // Email dove ricevere gli avvisi
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD; // Password app Gmail o SMTP

// Soglie di avviso (in caratteri)
const WARNING_THRESHOLDS = {
  HIGH: 0.85, // 85% del limite
  CRITICAL: 0.95 // 95% del limite
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Controlla l'uso corrente
    const usage = await checkDeepLUsage();
    
    if (usage.shouldAlert) {
      await sendAlert(usage);
    }
    
    res.status(200).json({
      success: true,
      usage: usage.data,
      alert: usage.shouldAlert ? usage.alertLevel : null
    });
    
  } catch (error) {
    console.error('Errore nel monitoraggio:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function checkDeepLUsage() {
  const apiUrl = DEEPL_API_KEY.endsWith(':fx') 
    ? 'https://api-free.deepl.com/v2/usage'
    : 'https://api.deepl.com/v2/usage';
    
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`DeepL API error: ${response.status}`);
  }
  
  const data = await response.json();
  const used = data.character_count;
  const limit = data.character_limit;
  const percentage = used / limit;
  
  let shouldAlert = false;
  let alertLevel = null;
  
  if (percentage >= WARNING_THRESHOLDS.CRITICAL) {
    shouldAlert = true;
    alertLevel = 'CRITICAL';
  } else if (percentage >= WARNING_THRESHOLDS.HIGH) {
    shouldAlert = true;
    alertLevel = 'HIGH';
  }
  
  return {
    data: {
      used,
      limit,
      remaining: limit - used,
      percentage: Math.round(percentage * 100),
      endTime: data.end_time
    },
    shouldAlert,
    alertLevel
  };
}

async function sendAlert(usage) {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: EMAIL_FROM,
      pass: EMAIL_PASSWORD
    }
  });
  
  const { used, limit, remaining, percentage, endTime } = usage.data;
  const isCritical = usage.alertLevel === 'CRITICAL';
  
  const subject = isCritical 
    ? '🚨 CRITICO: Caratteri DeepL quasi esauriti'
    : '⚠️ AVVISO: Caratteri DeepL in via di esaurimento';
    
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${isCritical ? '#ff4444' : '#ff9800'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">
          ${isCritical ? '🚨' : '⚠️'} Monitoraggio DeepL API
        </h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333; margin-top: 0;">Stato attuale utilizzo</h2>
        
        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Caratteri utilizzati:</td>
              <td style="padding: 8px 0; text-align: right;">${used.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Limite mensile:</td>
              <td style="padding: 8px 0; text-align: right;">${limit.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Caratteri rimanenti:</td>
              <td style="padding: 8px 0; text-align: right; color: ${isCritical ? '#ff4444' : '#ff9800'};">
                ${remaining.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Percentuale utilizzata:</td>
              <td style="padding: 8px 0; text-align: right; font-size: 18px; color: ${isCritical ? '#ff4444' : '#ff9800'};">
                ${percentage}%
              </td>
            </tr>
          </table>
        </div>
        
        <div style="background: ${isCritical ? '#ffebee' : '#fff3e0'}; padding: 15px; border-radius: 6px; border-left: 4px solid ${isCritical ? '#ff4444' : '#ff9800'};">
          <h3 style="margin-top: 0; color: ${isCritical ? '#c62828' : '#e65100'};">
            ${isCritical ? 'AZIONE RICHIESTA URGENTEMENTE' : 'Azione raccomandata'}
          </h3>
          <p style="margin-bottom: 0;">
            ${isCritical 
              ? 'I caratteri sono quasi esauriti! Aggiorna la chiave API DeepL il prima possibile per evitare interruzioni del servizio.'
              : 'Si consiglia di monitorare l\'uso e considerare l\'aggiornamento della chiave API se necessario.'
            }
          </p>
        </div>
        
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          Periodo di billing corrente: fino al ${new Date(endTime).toLocaleDateString('it-IT')}<br>
          Questo avviso è stato generato automaticamente dal sistema di monitoraggio Translation Pro.
        </p>
      </div>
    </div>
  `;
  
  const mailOptions = {
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    html: htmlContent
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Alert email sent: ${usage.alertLevel}`);
  } catch (error) {
    console.error('Errore nell\'invio email:', error);
  }
}

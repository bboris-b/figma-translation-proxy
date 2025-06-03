async function handler(req, res) {
  // Gestisci preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, sourceLang, targetLang, apiKey } = req.body;

    if (!text || !sourceLang || !targetLang || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: text, sourceLang, targetLang, apiKey' 
      });
    }

    // Mappa codici lingua per DeepL
    const langMap = {
      'it': 'IT',
      'en': 'EN',
      'es': 'ES',
      'fr': 'FR'
    };

    const sourceMapped = langMap[sourceLang] || sourceLang.toUpperCase();
    const targetMapped = langMap[targetLang] || targetLang.toUpperCase();

    console.log(`Traducendo: "${Array.isArray(text) ? text.length + ' testi' : text}" da ${sourceMapped} a ${targetMapped}`);

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: Array.isArray(text) ? text : [text],
        source_lang: sourceMapped,
        target_lang: targetMapped
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepL error:', response.status, errorText);
      
      if (response.status === 403) {
        return res.status(403).json({ 
          error: 'DeepL API Key non valida. Verifica la tua chiave.' 
        });
      } else if (response.status === 456) {
        return res.status(456).json({ 
          error: 'Quota caratteri DeepL esaurita. Riprova il mese prossimo.' 
        });
      }
      
      return res.status(response.status).json({ 
        error: `DeepL HTTP ${response.status}: ${response.statusText}` 
      });
    }

    const data = await response.json();

    if (data.translations && data.translations.length > 0) {
      const translatedTexts = data.translations.map(t => t.text);
      
      console.log(`Traduzione completata: ${translatedTexts.length} testi`);
      
      return res.status(200).json({
        translatedText: Array.isArray(text) ? translatedTexts : translatedTexts[0],
        originalText: text,
        sourceLang: sourceMapped,
        targetLang: targetMapped
      });
    } else {
      return res.status(500).json({ 
        error: 'Nessuna traduzione ricevuta da DeepL' 
      });
    }

  } catch (error) {
    console.error('Errore nel proxy:', error);
    return res.status(500).json({ 
      error: `Errore interno del server: ${error.message}` 
    });
  }
}

export default handler;

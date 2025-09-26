// Sistema di traduzione con fallback triplo: DeepL → Groq → Hugging Face + Analytics
export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, sourceLang, targetLang, apiKey } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isArray = Array.isArray(text);
    const textCount = isArray ? text.length : 1;

    console.log(`🚀 Inizio traduzione con fallback triplo: ${sourceLang || 'auto'} → ${targetLang}`);
    console.log(`📝 Testi da tradurre: ${textCount}`);

    let result;
    let usedService = '';

    // 1️⃣ PRIMO TENTATIVO: DeepL
    try {
      console.log('🔵 Tentativo 1: DeepL API...');
      result = await translateWithDeepL(text, sourceLang, targetLang, apiKey);
      usedService = 'deepl';
      console.log('✅ DeepL: Traduzione completata');
    } catch (deepLError) {
      console.log(`❌ DeepL fallito: ${deepLError.message}`);
      
      // Log fallback analytics
      await logAnalytics('api_fallback', { from: 'deepl', to: 'groq' });
      
      // 2️⃣ SECONDO TENTATIVO: Groq
      try {
        console.log('🟡 Tentativo 2: Groq API...');
        result = await translateWithGroq(text, sourceLang, targetLang);
        usedService = 'groq';
        console.log('✅ Groq: Traduzione completata');
      } catch (groqError) {
        console.log(`❌ Groq fallito: ${groqError.message}`);
        
        // Log fallback analytics
        await logAnalytics('api_fallback', { from: 'groq', to: 'huggingface' });
        
        // 3️⃣ TERZO TENTATIVO: Hugging Face
        try {
          console.log('🟠 Tentativo 3: Hugging Face...');
          result = await translateWithHuggingFace(text, sourceLang, targetLang);
          usedService = 'huggingface';
          console.log('✅ Hugging Face: Traduzione completata');
        } catch (hfError) {
          console.log(`❌ Tutti i servizi falliti. HF Error: ${hfError.message}`);
          
          // Log errore completo
          await logAnalytics('error', { 
            stage: 'all_services_failed',
            textCount 
          });
          
          throw new Error('Tutti i servizi di traduzione sono temporaneamente non disponibili');
        }
      }
    }

    // Log successo traduzione
    await logAnalytics('translation_completed', {
      service: usedService,
      textCount,
      targetLang
    });

    return res.status(200).json({
      translatedText: result,
      service: usedService,
      success: true
    });

  } catch (error) {
    console.error('💥 Errore generale:', error.message);
    
    // Log errore generale
    await logAnalytics('error', { 
      message: error.message,
      textCount: Array.isArray(req.body.text) ? req.body.text.length : 1
    });
    
    return res.status(500).json({ 
      error: error.message,
      service: 'none',
      success: false
    });
  }
}

// Funzione di logging analytics anonimo
async function logAnalytics(event, data = {}) {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
      
    await fetch(`${baseUrl}/api/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data })
    });
  } catch (error) {
    console.error('Analytics logging failed:', error);
    // Non bloccare la traduzione per errori di analytics
  }
}

// 🔵 DEEPL TRANSLATION FUNCTION
async function translateWithDeepL(text, sourceLang, targetLang, apiKey) {
  if (!apiKey) {
    throw new Error('DeepL API key missing');
  }

  const isArray = Array.isArray(text);
  const textsToTranslate = isArray ? text : [text];
  
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: textsToTranslate,
      source_lang: sourceLang === 'it' ? 'IT' : (sourceLang || 'auto').toUpperCase(),
      target_lang: targetLang.toUpperCase()
    })
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('DeepL: API key non valida');
    } else if (response.status === 456) {
      throw new Error('DeepL: Quota esaurita');
    }
    throw new Error(`DeepL HTTP ${response.status}`);
  }

  const data = await response.json();
  const translations = data.translations.map(t => t.text);
  
  return isArray ? translations : translations[0];
}

// 🟡 GROQ TRANSLATION FUNCTION
async function translateWithGroq(text, sourceLang, targetLang) {
  // API Key di Groq (la tua API key)
  const GROQ_API_KEY = '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';
  
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('INSERISCI')) {
    throw new Error('Groq API key non configurata');
  }

  const isArray = Array.isArray(text);
  const textsToTranslate = isArray ? text : [text];
  
  // Mapping lingue per Groq
  const langNames = {
    'en': 'English',
    'es': 'Spanish', 
    'fr': 'French',
    'it': 'Italian'
  };

  const sourceLangName = langNames[sourceLang] || 'Italian';
  const targetLangName = langNames[targetLang] || 'English';

  // Prepara il prompt per traduzione batch
  const prompt = `Translate the following texts from ${sourceLangName} to ${targetLangName}. 
Return ONLY the translations separated by "|||" in the same order:

${textsToTranslate.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Return only the translations separated by "|||" without numbering or extra text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Groq: Rate limit raggiunto');
    }
    throw new Error(`Groq HTTP ${response.status}`);
  }

  const data = await response.json();
  const translations = data.choices[0].message.content
    .split('|||')
    .map(t => t.trim());

  // Verifica che abbiamo il numero corretto di traduzioni
  if (translations.length !== textsToTranslate.length) {
    console.warn('Groq: Numero traduzioni non corrispondente, uso fallback');
    return textsToTranslate; // Fallback
  }

  return isArray ? translations : translations[0];
}

// 🟠 HUGGING FACE TRANSLATION FUNCTION
async function translateWithHuggingFace(text, sourceLang, targetLang) {
  // Token Hugging Face (il tuo token)
  const HF_TOKEN = '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';
  
  if (!HF_TOKEN || HF_TOKEN.includes('INSERISCI')) {
    throw new Error('Hugging Face token non configurato');
  }

  const isArray = Array.isArray(text);
  const textsToTranslate = isArray ? text : [text];
  
  // Selezione modello basata su lingue
  const getModelName = (source, target) => {
    const langPair = `${source}-${target}`;
    const models = {
      'it-en': 'Helsinki-NLP/opus-mt-it-en',
      'it-es': 'Helsinki-NLP/opus-mt-it-es', 
      'it-fr': 'Helsinki-NLP/opus-mt-it-fr'
    };
    return models[langPair] || 'Helsinki-NLP/opus-mt-it-en';
  };

  const modelName = getModelName(sourceLang || 'it', targetLang);
  
  const results = [];
  
  // Traduci testo per testo per evitare rate limiting
  for (const singleText of textsToTranslate) {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: singleText,
          options: {
            wait_for_model: true
          }
        })
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('HuggingFace: Rate limit, riprova tra poco');
      }
      throw new Error(`HuggingFace HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data[0] && data[0].translation_text) {
      results.push(data[0].translation_text);
    } else {
      results.push(singleText); // Fallback
    }

    // Pausa tra richieste per rispettare rate limits
    if (textsToTranslate.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return isArray ? results : results[0];
}

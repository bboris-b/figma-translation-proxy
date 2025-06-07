// api/cron-monitor.js
export default async function handler(req, res) {
  // Verifica che sia una chiamata da Vercel Cron o con token
  const authToken = req.headers.authorization;
  if (authToken !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Chiama l'endpoint di monitoraggio
    const baseUrl = `https://${req.headers.host}`;
    const response = await fetch(`${baseUrl}/api/monitor`);
    const result = await response.json();
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      monitoring: result
    });
    
  } catch (error) {
    console.error('Errore nel cron:', error);
    res.status(500).json({ error: error.message });
  }
}

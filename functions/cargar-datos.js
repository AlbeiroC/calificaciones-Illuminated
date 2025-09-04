const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/jugadores?select=*`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    if (!response.ok) {
      throw new Error('Error al cargar desde Supabase');
    }

    const jugadores = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ jugadores, vistaActual: 'ranking' })
    };
  } catch (error) {
    console.error('Error en cargar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al cargar datos', error: error.message })
    };
  }
};
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Configura el cliente de Supabase usando variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del usuario autorizado (reemplaza con el user_id del admin)
const ALLOWED_USER_ID = '6594ad3c-020b-4671-8321-7b60138faedf';

exports.handler = async function(event, context) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    // Verifica el token de autorización
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user || user.id !== ALLOWED_USER_ID) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized: Only the admin can view data' }) };
    }

    // Realiza la solicitud a Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/jugadores?select=*`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    if (!response.ok) {
      throw new Error('Error al cargar desde Supabase');
    }

    const jugadores = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ jugadores, vistaActual: 'ranking' }),
    };
  } catch (error) {
    console.error('Error en cargar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al cargar datos', error: error.message }),
    };
  }
};
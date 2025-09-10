const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Configura el cliente de Supabase usando variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del usuario autorizado (reemplaza con el user_id del admin)
const ALLOWED_USER_ID = 'c60554e6-2070-4c77-9bd1-9f441b0c4669';

exports.handler = async function(event, context) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    // Verifica el token de autorización
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      console.log('No se proporcionó encabezado de autorización');
      return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token recibido:', token);

    // Valida el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('Usuario validado:', user ? user.id : 'No válido');

    if (authError || !user || user.id !== ALLOWED_USER_ID) {
      console.log('Error de autorización o usuario no es admin:', authError?.message || 'Usuario no autorizado');
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized: Only the admin can view data' }) };
    }

    // Consulta los datos directamente con el cliente de Supabase
    const { data, error } = await supabase
      .from('jugadores')
      .select('*');

    if (error) {
      console.error('Error al consultar Supabase:', error.message);
      throw new Error(`Error al cargar desde Supabase: ${error.message}`);
    }

    console.log('Datos cargados desde Supabase:', data);
    return {
      statusCode: 200,
      body: JSON.stringify({ jugadores: data, vistaActual: 'ranking' }),
    };
  } catch (error) {
    console.error('Error en cargar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al cargar datos', error: error.message }),
    };
  }
};
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ALLOWED_USER_ID = 'c60554e6-2070-4c77-9bd1-9f441b0c4669';

exports.handler = async function(event, context) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan variables de entorno');
    }

    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user || user.id !== ALLOWED_USER_ID) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { jugadores, vistaActual, fechaGuardado } = JSON.parse(event.body);
    const { data, error } = await supabase.from('jugadores').insert(jugadores);

    if (error) throw new Error(error.message);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Datos guardados', jugadores: data, vistaActual, fechaGuardado }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al guardar datos', error: error.message }),
    };
  }
};
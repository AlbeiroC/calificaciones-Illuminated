const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del usuario autorizado (reemplaza con el user_id del admin si es diferente)
const ALLOWED_USER_ID = '6594ad3c-020b-4671-8321-7b60138faedf';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No authorization header' }),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user || user.id !== ALLOWED_USER_ID) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized: Only the admin can modify data' }),
    };
  }

  try {
    const { jugadores, vistaActual } = JSON.parse(event.body);

    if (!Array.isArray(jugadores)) {
      throw new Error('El campo "jugadores" debe ser un array');
    }

    const dataToInsert = jugadores.map(jugador => ({
      nombre: jugador.nombre,
      fecha: jugador.fecha,
      asistencia: jugador.asistencia,
      rendimiento: jugador.rendimiento,
      actitud: jugador.actitud,
      bonificaciones: jugador.bonificaciones,
      total: jugador.total,
      timestamp: jugador.timestamp || new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('jugadores')
      .upsert(dataToInsert, { onConflict: ['nombre', 'fecha'] }); // Evita duplicados basados en nombre y fecha

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Datos guardados correctamente' }),
    };
  } catch (error) {
    console.error('Error al guardar datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Error interno al guardar datos' }),
    };
  }
};
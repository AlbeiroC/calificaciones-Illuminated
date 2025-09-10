const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del usuario autorizado (reemplaza con el user_id del admin)
const ALLOWED_USER_ID = 'c60554e6-2070-4c77-9bd1-9f441b0c4669'; // Ajusta según tu admin

exports.handler = async function(event, context) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    const authHeader = event.headers.authorization;
    if (!authHeader) {
      console.log('No se proporcionó encabezado de autorización');
      return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token recibido:', token);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('Usuario validado:', user ? user.id : 'No válido');

    if (authError || !user || user.id !== ALLOWED_USER_ID) {
      console.log('Error de autorización o usuario no es admin:', authError?.message || 'Usuario no autorizado');
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized: Only the admin can save data' }) };
    }

    const { jugadores, vistaActual, fechaGuardado } = JSON.parse(event.body);

    // Limpiar la tabla antes de insertar (opción 1: reemplazar todo)
    await supabase.from('jugadores').delete().neq('id', 0); // Elimina todos los registros (ajusta si tienes un ID único)
    const { data, error } = await supabase.from('jugadores').insert(jugadores);

    if (error) {
      console.error('Error al insertar en Supabase:', error.message);
      throw new Error(`Error al guardar en Supabase: ${error.message}`);
    }

    console.log('Datos guardados en Supabase:', data);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Datos guardados correctamente', jugadores: data, vistaActual, fechaGuardado }),
    };
  } catch (error) {
    console.error('Error en guardar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al guardar datos', error: error.message }),
    };
  }
};
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

    const { jugadores, vistaActual, fechaGuardado, action, timestamp } = JSON.parse(event.body || '{}');

    if (action === 'delete' && timestamp) {
      // Eliminar el registro basado en el timestamp
      const { data, error } = await supabase
        .from('jugadores')
        .delete()
        .eq('timestamp', timestamp);

      if (error) throw new Error(`Error al eliminar: ${error.message}`);

      // Recargar los datos actualizados
      const { data: updatedData, error: loadError } = await supabase.from('jugadores').select('*');
      if (loadError) throw new Error(`Error al cargar datos actualizados: ${loadError.message}`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Registro eliminado', jugadores: updatedData, vistaActual, fechaGuardado }),
      };
    }

    // Si no es una eliminación y se proporcionan jugadores, insertar o actualizar
    if (jugadores && Array.isArray(jugadores) && jugadores.length > 0) {
      const { data, error } = await supabase.from('jugadores').upsert(jugadores, { onConflict: 'timestamp' });

      if (error) throw new Error(`Error al guardar: ${error.message}`);

      // Recargar los datos actualizados
      const { data: updatedData, error: loadError } = await supabase.from('jugadores').select('*');
      if (loadError) throw new Error(`Error al cargar datos actualizados: ${loadError.message}`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Datos guardados', jugadores: updatedData, vistaActual, fechaGuardado }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No se proporcionaron datos válidos o acción no soportada' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al procesar la solicitud', error: error.message }),
    };
  }
};
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    console.log('Raw event.body:', event.body);
    if (!event.body) {
      throw new Error('No se proporcionaron datos en el cuerpo de la solicitud');
    }
    const datos = JSON.parse(event.body);
    console.log('Parsed datos:', datos);
    if (!datos.jugadores || !Array.isArray(datos.jugadores)) {
      throw new Error('El cuerpo de la solicitud debe contener un array "jugadores"');
    }

    console.log('Datos a guardar:', datos.jugadores);
    const savedPlayers = [];

    for (const jugador of datos.jugadores) {
      if (!jugador.nombre || !jugador.fecha) {
        throw new Error(`Jugador ${jugador.nombre || 'sin nombre'} falta campo requerido (nombre o fecha)`);
      }

      // Filtrar solo los campos válidos
      const jugadorFiltrado = {
        nombre: jugador.nombre,
        fecha: jugador.fecha,
        asistencia: jugador.asistencia,
        rendimiento: jugador.rendimiento,
        actitud: jugador.actitud,
        bonificaciones: jugador.bonificaciones,
        total: jugador.total,
        timestamp: jugador.timestamp // Incluye solo si existe en la tabla
      };

      const response = await fetch(`${SUPABASE_URL}/rest/v1/jugadores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(jugadorFiltrado)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al guardar jugador ${jugador.nombre}: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      savedPlayers.push(result[0]);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Datos guardados correctamente', data: savedPlayers })
    };
  } catch (error) {
    console.error('Error en guardar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al guardar datos', error: error.message })
    };
  }
};
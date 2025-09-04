const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    if (!event.body) {
      throw new Error('No se proporcionaron datos en el cuerpo de la solicitud');
    }
    const datos = JSON.parse(event.body);
    if (!datos.jugadores || !Array.isArray(datos.jugadores)) {
      throw new Error('El cuerpo de la solicitud debe contener un array "jugadores"');
    }

    console.log('Datos recibidos:', datos.jugadores); // Depuración
    const savedPlayers = [];

    for (const jugador of datos.jugadores) {
      // Validar campos mínimos
      if (!jugador.nombre || !jugador.fecha) {
        throw new Error(`Jugador ${jugador.nombre || 'sin nombre'} falta campo requerido (nombre o fecha)`);
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/jugadores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(jugador)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al guardar jugador ${jugador.nombre}: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      savedPlayers.push(result[0]); // Agrega el registro devuelto
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
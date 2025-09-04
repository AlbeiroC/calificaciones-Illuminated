const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
    }

    // Validar que event.body exista y sea un JSON válido
    if (!event.body) {
      throw new Error('No se proporcionaron datos en el cuerpo de la solicitud');
    }
    const datos = JSON.parse(event.body);
    if (!datos.jugadores || !Array.isArray(datos.jugadores)) {
      throw new Error('El cuerpo de la solicitud debe contener un array "jugadores"');
    }

    // Iterar y guardar cada jugador
    for (const jugador of datos.jugadores) {
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
        const errorText = await response.text(); // Obtener detalles del error
        throw new Error(`Error al guardar jugador ${jugador.nombre}: ${response.status} - ${errorText}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Datos guardados correctamente' })
    };
  } catch (error) {
    console.error('Error en guardar-datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error al guardar datos', error: error.message })
    };
  }
};
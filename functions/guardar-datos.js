async function guardarDatos(nuevoJugador) {
  try {
    const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
    console.log('guardarDatos - Autenticado:', authenticated, 'Es admin:', isCurrentAdmin);
    if (!authenticated || !isCurrentAdmin) {
      mostrarNotificacion('No autorizado para guardar datos', 'error');
      return;
    }
    console.log('Guardando datos - nuevoJugador:', nuevoJugador);

    const datos = nuevoJugador
      ? {
          jugadores: [
            {
              nombre: nuevoJugador.nombre,
              fecha: nuevoJugador.fecha,
              asistencia: nuevoJugador.asistencia,
              rendimiento: nuevoJugador.rendimiento,
              actitud: nuevoJugador.actitud,
              bonificaciones: nuevoJugador.bonificaciones,
              total: nuevoJugador.total,
              timestamp: nuevoJugador.timestamp || new Date().toISOString(),
            },
          ],
          vistaActual,
          fechaGuardado: new Date().toISOString(),
        }
      : {
          jugadores: jugadores.map(j => ({
            nombre: j.nombre,
            fecha: j.fecha,
            asistencia: j.asistencia,
            rendimiento: j.rendimiento,
            actitud: j.actitud,
            bonificaciones: j.bonificaciones,
            total: j.total,
            timestamp: j.timestamp || new Date().toISOString(),
          })),
          vistaActual,
          fechaGuardado: new Date().toISOString(),
        };

    const { data: { session } } = await supabase.auth.getSession();
    const token = session.access_token;

    const response = await fetch(`${functionBaseUrl}/guardar-datos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error(`Error al guardar en Supabase: ${await response.text()}`);
    const result = await response.json();
    console.log('Respuesta de guardar-datos:', result);
    // Actualizar jugadores con los id generados por Supabase
    if (result.jugadores && Array.isArray(result.jugadores)) {
      jugadores = result.jugadores.map(j => ({
        ...j,
        timestamp: j.timestamp || new Date().toISOString(), // Asegurar que timestamp no se pierda
      }));
    }
    vistaActual = result.vistaActual || vistaActual;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jugadores, vistaActual, fechaGuardado: result.fechaGuardado || new Date().toISOString() }));
    console.log('💾 Datos guardados en Supabase');
    mostrarNotificacion('Datos guardados correctamente', 'success');
  } catch (error) {
    console.error('❌ Error al guardar datos:', error);
    mostrarNotificacion('Error al guardar en Supabase, usando localStorage.', 'error');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jugadores, vistaActual, fechaGuardado: new Date().toISOString() }));
  }
}
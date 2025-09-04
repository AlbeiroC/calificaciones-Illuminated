async function cargarDatos() {
    try {
        const response = await fetch('/.netlify/functions/cargar-datos');
        const data = await response.json();
        if (response.ok && data.jugadores && data.jugadores.length > 0) {
            jugadores = data.jugadores; // Asigna los jugadores de Supabase
            vistaActual = data.vistaActual || 'ranking'; // Usa la vista devuelta o 'ranking'
            localStorage.setItem('jugadores', JSON.stringify(jugadores)); // Opcional: guarda en localStorage como backup
            console.log(`✅ Datos cargados desde Supabase: ${jugadores.length} registros`);
        } else {
            console.log('ℹ️ No se encontraron datos en Supabase, intentando localStorage');
            const storedData = JSON.parse(localStorage.getItem('jugadores')) || [];
            if (storedData.length > 0) {
                jugadores = storedData;
                console.log(`✅ Datos cargados desde localStorage: ${storedData.length} registros`);
            } else {
                jugadores = []; // Si no hay datos en ningún lado, inicializa vacío
                console.log('ℹ️ No hay datos disponibles');
            }
        }
    } catch (error) {
        console.error('❌ Error al cargar datos desde Supabase:', error);
        const storedData = JSON.parse(localStorage.getItem('jugadores')) || [];
        if (storedData.length > 0) {
            jugadores = storedData;
            console.log(`✅ Datos cargados desde localStorage: ${storedData.length} registros`);
        } else {
            jugadores = [];
            console.log('ℹ️ No hay datos disponibles debido a un error');
        }
    }
    actualizarVista(); // Asegúrate de que esta función exista y se llame
}
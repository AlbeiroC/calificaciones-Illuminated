// Acceder a createClient desde el objeto global de Supabase cargado por el CDN
const { createClient } = window.supabase;

// Configura las credenciales de Supabase (reemplaza con tus valores reales)
const supabaseUrl = 'https://faaeszqpwybpmsasbywl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYWVzenFwd3licG1zYXNieXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NDQzMTksImV4cCI6MjA3MjQyMDMxOX0.WYEykLzGGoQwZ73W7Cbm9lgZRUQSo5bbWWXvLi4uY98';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Detectar si estamos en Netlify (producción) o local
const isNetlify = window.location.hostname.includes('netlify.app') || window.location.hostname.includes('localhost') === false;
const functionBaseUrl = isNetlify ? '/.netlify/functions' : 'http://localhost:8888/.netlify/functions';

let jugadores = [];
let vistaActual = 'ranking';
const STORAGE_KEY = 'illuminated_fc_data';
let isAdmin = false;

// Escuchar cambios en la autenticación
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session ? `Sesión encontrada con ID: ${session.user.id}` : 'Sin sesión');
  if (event === 'SIGNED_IN' && session) {
    console.log('Usuario autenticado con ID:', session.user.id);
    isAdmin = session.user.id === 'c60554e6-2070-4c77-9bd1-9f441b0c4669'; // ID del administrador
    cargarDatos();
    if (document.querySelector('div#loginDiv')) {
      document.querySelector('div#loginDiv').remove();
      document.querySelectorAll('.btn, .expand-btn, .clear-btn').forEach(el => (el.disabled = false)); // Excluir inputs
    }
  } else if (event === 'SIGNED_OUT') {
    console.log('Usuario desautenticado');
    isAdmin = false;
    jugadores = [];
    localStorage.removeItem(STORAGE_KEY);
    actualizarResultados();
  }
});

async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('checkAuth - Sesión:', session, 'Error:', error);
    if (error || !session) {
      console.log('Usuario no autenticado, intentando refrescar sesión...');
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session) {
        console.log('No se pudo refrescar la sesión:', refreshError?.message || 'Sin sesión activa');
        return { authenticated: false, isAdmin: false };
      }
      console.log('Sesión refrescada con éxito');
    }
    const adminCheck = session.user.id === 'c60554e6-2070-4c77-9bd1-9f441b0c4669'; // ID del administrador
    return { authenticated: true, isAdmin: adminCheck };
  } catch (error) {
    console.error('Error en autenticación:', error);
    return { authenticated: false, isAdmin: false };
  }
}

async function cargarDatos() {
  try {
    const { authenticated } = await checkAuth();
    console.log('cargarDatos - Autenticado:', authenticated);
    if (!authenticated) {
      console.log('Cargando datos sin autenticación, usando localStorage.');
      const datosGuardados = localStorage.getItem(STORAGE_KEY);
      if (datosGuardados) {
        const datos = JSON.parse(datosGuardados);
        jugadores = datos.jugadores || [];
        vistaActual = datos.vistaActual || 'ranking';
        console.log(`✅ Datos cargados desde localStorage: ${jugadores.length} registros`);
      } else {
        console.log('ℹ️ No se encontraron datos previos');
        jugadores = [];
      }
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session.access_token;
    console.log('Token de sesión:', token);

    const response = await fetch(`${functionBaseUrl}/cargar-datos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Error al cargar desde Supabase: ${await response.text()}`);
    const datos = await response.json();
    jugadores = datos.jugadores || []; // Asegura que solo se asignen los datos cargados
    vistaActual = datos.vistaActual || 'ranking';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jugadores, vistaActual })); // Sincroniza localStorage
    actualizarVistas();
    console.log(`✅ Datos cargados desde Supabase: ${jugadores.length} registros`);
  } catch (error) {
    console.error('❌ Error al cargar datos desde Supabase:', error);
    const datosGuardados = localStorage.getItem(STORAGE_KEY);
    if (datosGuardados) {
      const datos = JSON.parse(datosGuardados);
      jugadores = datos.jugadores || [];
      vistaActual = datos.vistaActual || 'ranking';
      console.log(`✅ Datos cargados desde localStorage: ${jugadores.length} registros`);
    } else {
      console.log('ℹ️ No se encontraron datos previos');
      jugadores = [];
    }
    mostrarNotificacion('Error al cargar desde Supabase, usando localStorage.', 'warning');
  }
  actualizarResultados();
}

async function guardarDatos(nuevoJugador) {
  try {
    const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
    console.log('guardarDatos - Autenticado:', authenticated, 'Es admin:', isCurrentAdmin);
    if (!authenticated || !isCurrentAdmin) {
      mostrarNotificacion('Solo el administrador puede guardar datos', 'error');
      return;
    }
    console.log('Guardando datos - nuevoJugador:', nuevoJugador);
    let datos;
    if (nuevoJugador) {
      // Añadir el nuevo jugador a la lista existente, excluyendo bonificacionesDetalle
      const nuevoJugadorData = {
        nombre: nuevoJugador.nombre,
        fecha: nuevoJugador.fecha,
        asistencia: nuevoJugador.asistencia,
        rendimiento: nuevoJugador.rendimiento,
        actitud: nuevoJugador.actitud,
        bonificaciones: nuevoJugador.bonificaciones,
        total: nuevoJugador.total,
        timestamp: nuevoJugador.timestamp || new Date().toISOString(),
      };
      datos = {
        jugadores: [...jugadores, nuevoJugadorData],
        vistaActual,
        fechaGuardado: new Date().toISOString(),
      };
    } else {
      // Enviar todos los jugadores actuales, excluyendo bonificacionesDetalle
      datos = {
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
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session.access_token;
    console.log('Token de sesión para guardar:', token);

    const response = await fetch(`${functionBaseUrl}/guardar-datos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error(`Error al guardar en Supabase: ${response.status} - ${response.statusText}`);
    const result = await response.json();
    console.log('Respuesta de guardar-datos:', result);
    jugadores = result.jugadores || []; // Actualiza con los datos devueltos por Supabase
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

function mostrarNotificacion(mensaje, tipo = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 10px; right: 10px; padding: 10px 15px;
    border-radius: 6px; color: white; font-weight: 600; z-index: 1000;
    transform: translateX(100%); transition: transform 0.3s ease;
    max-width: 90%; box-shadow: 0 3px 10px rgba(0,0,0,0.2); font-size: 0.9rem;
  `;
  notification.textContent = mensaje;
  switch (tipo) {
    case 'success':
      notification.style.backgroundColor = '#28a745';
      break;
    case 'error':
      notification.style.backgroundColor = '#dc3545';
      break;
    case 'warning':
      notification.style.backgroundColor = '#ffc107';
      notification.style.color = '#000';
      break;
    default:
      notification.style.backgroundColor = '#17a2b8';
  }
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM cargado, iniciando...');
  document.getElementById('matchDate').valueAsDate = new Date();
  await cargarDatos();
  actualizarResultados();
  if (jugadores.length > 0) {
    setTimeout(() => mostrarNotificacion(`Bienvenido de vuelta! ${jugadores.length} registros cargados`, 'info'), 1000);
  }

  // Verificar estado de autenticación al cargar
  console.log('Verificando sesión...');
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('Sesión obtenida:', session, 'Error:', error);
  if (!session) {
    console.log('No hay sesión, mostrando formulario de login...');
    // Crear formulario de login
    const loginDiv = document.createElement('div');
    loginDiv.id = 'loginDiv';
    loginDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000;';
    loginDiv.innerHTML = `
      <h3>Iniciar Sesión</h3>
      <input type="email" id="email" placeholder="Correo electrónico" style="width: 200px; padding: 5px; margin: 5px 0;" required>
      <input type="password" id="password" placeholder="Contraseña" style="width: 200px; padding: 5px; margin: 5px 0;" required minlength="6">
      <button id="loginBtn" style="padding: 5px 10px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Iniciar Sesión</button>
      <button id="signupBtn" style="padding: 5px 10px; background: #34a853; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">Registrarse</button>
    `;
    document.body.appendChild(loginDiv);

    document.getElementById('loginBtn').addEventListener('click', async () => {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) {
        mostrarNotificacion('Por favor, completa todos los campos.', 'error');
        return;
      }
      console.log('Intentando iniciar sesión con:', email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Resultado de signIn:', data, 'Error:', error);
      if (error) mostrarNotificacion(`Error: ${error.message}`, 'error');
    });

    document.getElementById('signupBtn').addEventListener('click', async () => {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password || password.length < 6) {
        mostrarNotificacion('El email y la contraseña (mínimo 6 caracteres) son obligatorios.', 'error');
        return;
      }
      console.log('Intentando registrarse con:', email);
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log('Resultado de signUp:', data, 'Error:', error);
      if (error) mostrarNotificacion(`Error: ${error.message}`, 'error');
      else {
        mostrarNotificacion('Registro exitoso, verifica tu correo si es necesario.', 'success');
        await supabase.auth.refreshSession(); // Forzar refresh de sesión
        console.log('Sesión refrescada tras registro:', await supabase.auth.getSession());
      }
    });

    // No desactivar los inputs del formulario, solo los botones principales
    document.querySelectorAll('.calculate-btn, .expand-btn, .clear-btn').forEach(el => (el.disabled = true));
  } else {
    console.log('Usuario autenticado con ID:', session.user.id);
    isAdmin = session.user.id === 'c60554e6-2070-4c77-9bd1-9f441b0c4669'; // ID del administrador
    document.querySelectorAll('.btn, .expand-btn, .clear-btn').forEach(el => (el.disabled = false)); // Excluir inputs
  }

  // Listeners para botones
  document.querySelector('.calculate-btn')?.addEventListener('click', calcularCalificacion);
  document.querySelector('#rankingBtn')?.addEventListener('click', () => mostrarVista('ranking'));
  document.querySelector('#historialBtn')?.addEventListener('click', () => mostrarVista('historial'));
  document.querySelector('#avanzadoBtn')?.addEventListener('click', () => mostrarVista('avanzado'));
});

// ... (código anterior hasta calcularCalificacion permanece igual)

async function calcularCalificacion() {
  if (!(await checkAuth()).authenticated) {
    mostrarNotificacion('Solo el administrador puede calificar jugadores', 'error');
    return;
  }
  const nombre = document.getElementById('playerName').value.trim();
  const fecha = document.getElementById('matchDate').value;

  if (!nombre) {
    alert('Por favor ingrese el nombre del jugador');
    return;
  }
  if (!fecha) {
    alert('Por favor seleccione la fecha del partido');
    return;
  }

  const asistencia = parseInt(document.querySelector('input[name="asistencia"]:checked')?.value || 0);
  const rendimiento = parseInt(document.querySelector('input[name="rendimiento"]:checked')?.value || 0);
  const actitud = parseInt(document.querySelector('input[name="actitud"]:checked')?.value || 0);
  let bonificaciones = 0;
  const bonificacionesDetalle = [];
  document.querySelectorAll('.criteria-section:last-child input[type="checkbox"]:checked').forEach(checkbox => {
    bonificaciones += parseInt(checkbox.value);
    bonificacionesDetalle.push({ nombre: checkbox.parentElement.textContent.trim(), puntos: parseInt(checkbox.value) });
  });

  const total = asistencia + rendimiento + actitud + bonificaciones;
  // Crear jugador completo con bonificacionesDetalle para la interfaz
  const jugadorCompleto = { nombre, fecha, asistencia, rendimiento, actitud, bonificaciones, bonificacionesDetalle, total, timestamp: new Date() };
  jugadores.unshift(jugadorCompleto);

  // Crear versión filtrada para guardar en Supabase, excluyendo bonificacionesDetalle
  const jugadorParaGuardar = { nombre, fecha, asistencia, rendimiento, actitud, bonificaciones, total, timestamp: new Date().toISOString() };
  await guardarDatos(jugadorParaGuardar);
  mostrarNotificacion(`Calificación de ${nombre} guardada correctamente`, 'success');
  actualizarResultados();

  document.getElementById('playerName').value = '';
  document.querySelectorAll('input[type="radio"]').forEach(radio => (radio.checked = false));
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => (checkbox.checked = false));
}

// ... (código posterior permanece igual)

function mostrarVista(vista) {
  vistaActual = vista;
  document.getElementById('rankingBtn').classList.remove('active');
  document.getElementById('historialBtn').classList.remove('active');
  document.getElementById('avanzadoBtn').classList.remove('active');
  document.getElementById(vista + 'Btn').classList.add('active');
  guardarDatos();
  actualizarResultados();
}

function consolidarJugadores() {
  const jugadoresConsolidados = {};
  jugadores.forEach(jugador => {
    const nombre = jugador.nombre.toLowerCase().trim();
    if (!jugadoresConsolidados[nombre]) {
      jugadoresConsolidados[nombre] = {
        nombre: jugador.nombre,
        partidos: [],
        totalPartidos: 0,
        sumaTotal: 0,
        promedio: 0,
        mejorPartido: 0,
        peorPartido: Infinity,
        ultimaFecha: null,
      };
    }
    const consolidado = jugadoresConsolidados[nombre];
    consolidado.partidos.push(jugador);
    consolidado.totalPartidos++;
    consolidado.sumaTotal += jugador.total;
    consolidado.mejorPartido = Math.max(consolidado.mejorPartido, jugador.total);
    consolidado.peorPartido = Math.min(consolidado.peorPartido, jugador.total);
    const fechaPartido = new Date(jugador.fecha);
    if (!consolidado.ultimaFecha || fechaPartido > consolidado.ultimaFecha) consolidado.ultimaFecha = fechaPartido;
  });
  Object.values(jugadoresConsolidados).forEach(jugador => {
    jugador.promedio = jugador.sumaTotal / jugador.totalPartidos;
    jugador.partidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  });
  return Object.values(jugadoresConsolidados);
}

function actualizarResultados() {
  const container = document.getElementById('resultados');
  if (jugadores.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #666; padding: 30px">
        <h3>No hay calificaciones registradas</h3>
        <p>Complete el formulario y presione "Calcular Calificación" para ver los resultados.</p>
      </div>
    `;
    return;
  }
  if (vistaActual === 'ranking') mostrarRankingConsolidado(container);
  else if (vistaActual === 'historial') mostrarHistorialCompleto(container);
  else if (vistaActual === 'avanzado') mostrarFuncionalidadesAvanzadas(container);
}

function mostrarRankingConsolidado(container) {
  const jugadoresConsolidados = consolidarJugadores();
  const jugadoresOrdenados = jugadoresConsolidados.sort((a, b) => b.promedio - a.promedio);
  let html = `
    <div class="total-score">
      <h3>📊 Estadísticas Generales</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-top: 10px;">
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #FFD700;">${(jugadores.reduce((sum, j) => sum + j.total, 0) / jugadores.length).toFixed(1)}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Promedio General</div></div>
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #51cf66;">${jugadores.length}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Total Partidos</div></div>
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #ff6b6b;">${jugadoresConsolidados.length}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Jugadores</div></div>
      </div>
    </div>
    <h3 style="color: #000; margin: 15px 0 10px 0; display: flex; align-items: center; gap: 8px;">🏆 Ranking de Jugadores (Promedio)</h3>
    <table class="ranking-table">
      <thead><tr><th>#</th><th>Jugador</th><th>Promedio</th><th>Partidos</th><th>Mejor</th><th>Último Partido</th><th>Acciones</th></tr></thead><tbody>
  `;
  jugadoresOrdenados.forEach((jugador, index) => {
    const position = index + 1;
    const positionClass = position <= 3 ? `rank-${position}` : '';
    const positionBadgeClass = position === 1 ? 'position-1' : position === 2 ? 'position-2' : position === 3 ? 'position-3' : 'position-other';
    html += `
      <tr class="${positionClass}">
        <td><div class="position-badge ${positionBadgeClass}">${position}</div></td>
        <td style="font-weight: 600; color: #000;">${jugador.nombre}</td>
        <td class="score-cell">${jugador.promedio.toFixed(1)}</td>
        <td>${jugador.totalPartidos}</td>
        <td style="color: #51cf66; font-weight: bold;">${jugador.mejorPartido}</td>
        <td>${jugador.ultimaFecha.toLocaleDateString('es-ES')}</td>
        <td><button class="expand-btn" data-player="${jugador.nombre}" ${!isAdmin ? 'disabled' : ''}>Ver Historial</button></td>
      </tr>
      <tr id="historial-${jugador.nombre.replace(/\s+/g, '-')}" style="display: none;"><td colspan="7"><div class="player-history"><h4 style="margin-bottom: 8px; color: #000;">Historial de ${jugador.nombre}</h4>${jugador.partidos
        .map(
          (partido, idx) => `
        <div class="history-item">
          <div><strong>${new Date(partido.fecha).toLocaleDateString('es-ES')}</strong> - ${partido.total} pts (A:${partido.asistencia} | R:${partido.rendimiento} | C:${partido.actitud}${partido.bonificaciones > 0 ? ` | B:${partido.bonificaciones}` : ''})</div>
          <button data-index="${jugadores.indexOf(partido)}" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 10px;" ${!isAdmin ? 'disabled' : ''}>Eliminar</button>
        </div>`
        )
        .join('')}</div></td></tr>
    `;
  });
  html += `</tbody></table><div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;"><button class="btn" data-action="export" style="flex: 1; background: #28a745; border-color: #28a745;" ${!isAdmin ? 'disabled' : ''}>📤 Exportar Datos</button><button class="btn" data-action="import" style="flex: 1; background: #17a2b8; border-color: #17a2b8;" ${!isAdmin ? 'disabled' : ''}>📥 Importar Datos</button></div><button class="btn clear-btn" data-action="clear" ${!isAdmin ? 'disabled' : ''}>🗑️ Limpiar Todo el Historial</button>`;
  container.innerHTML = html;
}

function mostrarHistorialCompleto(container) {
  const jugadoresOrdenados = [...jugadores].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  let html = `
    <div class="total-score">
      <h3>📊 Estadísticas del Historial</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-top: 10px;">
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #FFD700;">${(jugadores.reduce((sum, j) => sum + j.total, 0) / jugadores.length).toFixed(1)}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Promedio</div></div>
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #51cf66;">${Math.max(...jugadores.map(j => j.total))}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Máximo</div></div>
        <div><div style="font-size: 1.3rem; font-weight: bold; color: #ff6b6b;">${Math.min(...jugadores.map(j => j.total))}</div><div style="font-size: 0.85rem; color: #FFFFFF;">Mínimo</div></div>
      </div>
    </div>
    <h3 style="color: #000; margin: 15px 0 10px 0;">📋 Historial Completo de Partidos</h3>
  `;
  jugadoresOrdenados.forEach((jugador, index) => {
    const originalIndex = jugadores.findIndex(j => j.timestamp.toString() === jugador.timestamp.toString());
    const performanceClass = getPerformanceClass(jugador.rendimiento);
    const performanceIcon = getPerformanceIcon(jugador.rendimiento);
    html += `
      <div class="player-card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div class="player-name">${jugador.nombre}</div>
            <div class="player-score">${jugador.total} pts</div>
            <div class="performance-indicators">
              <div class="indicator ${performanceClass}" title="Rendimiento: ${jugador.rendimiento}/5">${performanceIcon}</div>
              <div style="margin-left: 8px; font-size: 0.85rem; color: #666;">${new Date(jugador.fecha).toLocaleDateString('es-ES')}</div>
            </div>
          </div>
          <button data-index="${originalIndex}" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px; margin-left: 8px;" ${!isAdmin ? 'disabled' : ''}>×</button>
        </div>
        <div class="score-breakdown"><strong>Desglose:</strong><br>Asistencia: ${jugador.asistencia} pts | Rendimiento: ${jugador.rendimiento} pts | Actitud: ${jugador.actitud} pts${jugador.bonificaciones > 0 ? ` | Bonificaciones: ${jugador.bonificaciones} pts` : ''}</div>
      </div>
    `;
  });
  html += `
    <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
      <button class="btn" data-action="export" style="flex: 1; background: #28a745; border-color: #28a745;" ${!isAdmin ? 'disabled' : ''}>📤 Exportar Datos</button>
      <button class="btn" data-action="import" style="flex: 1; background: #17a2b8; border-color: #17a2b8;" ${!isAdmin ? 'disabled' : ''}>📥 Importar Datos</button>
    </div>
    <button class="btn clear-btn" data-action="clear" ${!isAdmin ? 'disabled' : ''}>🗑️ Limpiar Todo</button>
  `;
  container.innerHTML = html;
}

function mostrarFuncionalidadesAvanzadas(container) {
  container.innerHTML = `
    <div style="text-align: center; color: #666; padding: 20px;">
      <h3>⚡ Funciones Avanzadas</h3>
      <p>Esta sección está en desarrollo. Pronto podrás acceder a análisis avanzados y estadísticas detalladas.</p>
    </div>
  `;
}

async function toggleHistorialJugador(nombreJugador) {
  if (!(await checkAuth()).authenticated) return;
  const id = `historial-${nombreJugador.replace(/\s+/g, '-')}`;
  const elemento = document.getElementById(id);
  elemento.style.display = elemento.style.display === 'none' ? '' : 'none';
}

async function eliminarPartido(index) {
  const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
  if (!authenticated || !isCurrentAdmin) {
    mostrarNotificacion('Solo el administrador puede eliminar partidos', 'error');
    return;
  }
  if (confirm('¿Está seguro de eliminar este partido del historial?')) {
    jugadores.splice(index, 1);
    guardarDatos();
    actualizarResultados();
  }
}

async function limpiarTodo() {
  const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
  if (!authenticated || !isCurrentAdmin) {
    mostrarNotificacion('Solo el administrador puede limpiar el historial', 'error');
    return;
  }
  if (confirm('¿Está seguro de eliminar todas las calificaciones?')) {
    jugadores = [];
    guardarDatos();
    actualizarResultados();
  }
}

function getPerformanceClass(rendimiento) {
  return rendimiento === 5 ? 'star' : rendimiento === 4 ? 'fire' : rendimiento === 3 ? 'check' : rendimiento === 2 ? 'warning' : 'cross';
}

function getPerformanceIcon(rendimiento) {
  return rendimiento === 5 ? '⭐' : rendimiento === 4 ? '🔥' : rendimiento === 3 ? '✅' : rendimiento === 2 ? '⚠️' : '❌';
}

async function exportarDatos() {
  const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
  if (!authenticated || !isCurrentAdmin) {
    mostrarNotificacion('Solo el administrador puede exportar datos', 'error');
    return;
  }
  try {
    const datos = { jugadores, fechaExportacion: new Date().toISOString(), totalRegistros: jugadores.length, version: '1.0' };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(datos, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `calificaciones_illuminated_fc_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion(`Datos exportados: ${datos.totalRegistros} registros`, 'success');
  } catch (error) {
    console.error('Error al exportar:', error);
    mostrarNotificacion('Error al exportar datos', 'error');
  }
}

async function importarDatos() {
  const { authenticated, isAdmin: isCurrentAdmin } = await checkAuth();
  if (!authenticated || !isCurrentAdmin) {
    mostrarNotificacion('Solo el administrador puede importar datos', 'error');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const datos = JSON.parse(e.target.result);
          if (datos.jugadores && Array.isArray(datos.jugadores)) {
            if (confirm(`¿Importar ${datos.jugadores.length} registros? Esto se agregará a los datos existentes.`)) {
              jugadores = [...jugadores, ...datos.jugadores];
              guardarDatos();
              mostrarNotificacion(`${datos.jugadores.length} registros importados correctamente`, 'success');
              actualizarResultados();
            }
          } else {
            mostrarNotificacion('Formato de archivo inválido', 'error');
          }
        } catch (error) {
          console.error('Error al importar:', error);
          mostrarNotificacion('Error al leer el archivo', 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function actualizarVistas() {
  document.getElementById('rankingBtn').classList.remove('active');
  document.getElementById('historialBtn').classList.remove('active');
  document.getElementById('avanzadoBtn').classList.remove('active');
  document.getElementById(vistaActual + 'Btn').classList.add('active');
}

// Delegación de eventos para botones dinámicos
document.addEventListener('click', async (e) => {
  const target = e.target;
  if (target.classList.contains('expand-btn')) {
    await toggleHistorialJugador(target.dataset.player);
  } else if (target.dataset.action === 'export') {
    await exportarDatos();
  } else if (target.dataset.action === 'import') {
    await importarDatos();
  } else if (target.dataset.action === 'clear') {
    await limpiarTodo();
  } else if (target.dataset.index !== undefined) {
    await eliminarPartido(parseInt(target.dataset.index));
  }
});
import mistareaRepository from '../repositories/mistarea.repository.js';
import { TareaTecnicoModel } from '../models/mistarea.model.js';

class MiTareaService {
    async obtenerMisTareas(idUsuario) {
        const rawData = await mistareaRepository.findTareasDeTecnico(idUsuario);
        const tareas = TareaTecnicoModel.fromDatabaseArray(rawData);
        const atendidas = tareas.filter(t => t.estadoCrudo === 'A').length;
        const pendientesDescarga = await mistareaRepository.contarPendientesDescarga(idUsuario);

        return { tareas, total: tareas.length, atendidas, pendientesDescarga };
    }

    // El botón "Descargar Tareas" del Home solo debe reaparecer cuando hay asignaciones nuevas
    // (ESTADO='I') que este dispositivo todavía no bajó; se llama justo después de una descarga exitosa.
    async marcarDescargado(idUsuario) {
        await mistareaRepository.marcarDescargado(idUsuario);
    }

    // nuevoEstado: 'A' (Atendido) o 'E' (Mantenimiento / en proceso). Por defecto 'A' para no
    // romper al botón simple de "Marcar atendido" en Mis Tareas, que nunca manda un body.
    async marcarAtendido(idRequerimiento, idUsuario, nuevoEstado = 'A') {
        const id = Number(idRequerimiento);
        if (!id || Number.isNaN(id)) {
            throw new Error('VALIDACION_FALLIDA: El bache no es válido.');
        }
        if (!['A', 'E'].includes(nuevoEstado)) {
            throw new Error('VALIDACION_FALLIDA: El estado no es válido.');
        }

        const pertenece = await mistareaRepository.perteneceATecnico(id, idUsuario);
        if (!pertenece) {
            throw new Error('NO_AUTORIZADO');
        }

        await mistareaRepository.actualizarEstado(id, nuevoEstado);

        // Solo al llegar a Atendido de verdad se cierra la asignación (nunca en Mantenimiento,
        // para no romper la validación de pertenencia de un segundo cambio de estado sobre el mismo bache).
        if (nuevoEstado === 'A') {
            await mistareaRepository.finalizarAsignaciones(id);
        }
    }
}

export default new MiTareaService();

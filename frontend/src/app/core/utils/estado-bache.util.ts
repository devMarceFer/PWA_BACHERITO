// Código real de OP_BACHERITO_REQ.ESTADO -> texto legible (mismo mapeo que usa el backend)
export const LABEL_POR_ESTADO: Record<string, string> = {
  I: 'INGRESADO',
  E: 'EN PROCESO',
  R: 'REASIGNADO',
  A: 'ATENDIDO'
};

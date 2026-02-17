import { sileo } from 'sileo';

export const showSuccess = (msg) =>
  sileo.success({ title: 'Operación exitosa', description: msg });

export const showError = (msg) =>
  sileo.error({ title: 'Algo salió mal', description: msg });

export const showInfo = (msg) =>
  sileo.info({ title: 'Información', description: msg });

export const showWarning = (msg) =>
  sileo.warning({ title: 'Atención', description: msg });

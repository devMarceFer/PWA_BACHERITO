export const environment = {
  production: false,
  // Base del backend. En desarrollo apunta al servidor local; en producción se reemplaza vía environment.prod.ts.
  apiUrl: 'http://localhost:3000/api',
  cognito: {
    userPoolId: 'us-east-2_N9vEv3kzl',
    clientId: '75g27vfgbofs93mqvh4ss18qdc',
    region: 'us-east-2',
    // Grupo de Cognito (satélite) que este frontend requiere para permitir el acceso
    satelite: 'BACHERITO'
  }
};

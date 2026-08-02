export const environment = {
  production: true,
  // TODO: reemplazar con la URL real del backend cuando esté disponible
  apiUrl: 'https://tu-api.municipal.com/api',
  cognito: {
    userPoolId: 'us-east-2_N9vEv3kzl',
    clientId: '75g27vfgbofs93mqvh4ss18qdc',
    region: 'us-east-2',
    // Grupo de Cognito (satélite) que este frontend requiere para permitir el acceso
    satelite: 'BACHERITO'
  }
};

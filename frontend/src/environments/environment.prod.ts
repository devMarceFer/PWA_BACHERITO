export const environment = {
  production: true,
  // Backend de producción: reemplaza la URL de desarrollo
  apiUrl: 'https://bacherito.ambato.gob.ec/api',
  cognito: {
    userPoolId: 'us-east-2_N9vEv3kzl',
    clientId: '75g27vfgbofs93mqvh4ss18qdc',
    region: 'us-east-2',
    // Grupo de Cognito (satélite) que este frontend requiere para permitir el acceso
    satelite: 'BACHERITO',
    // Dominio Hosted UI del User Pool de producción (us-east-2_N9vEv3kzl)
    // Callback/Sign-out URLs registradas en el App Client de Cognito
    oauth: {
      domain: 'us-east-2-n9vev3kzl.auth.us-east-2.amazoncognito.com',
      identityProvider: 'AzureAD',
      redirectSignIn: 'https://bacherito.ambato.gob.ec/auth/callback',
      redirectSignOut: 'https://bacherito.ambato.gob.ec/login',
    },
  }
};

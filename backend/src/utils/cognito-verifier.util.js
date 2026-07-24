import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Verifica firma, emisor, audiencia (Client ID), token_use='id' y expiración del ID Token
// que el frontend obtiene de AWS Cognito tras autenticarse. La clave pública (JWKS) se
// descarga una sola vez del User Pool y se cachea en memoria para las siguientes verificaciones.
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'id',
    clientId: process.env.COGNITO_CLIENT_ID
});

export async function verificarIdTokenCognito(idTokenJwt) {
    return verifier.verify(idTokenJwt);
}

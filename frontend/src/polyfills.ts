// amazon-cognito-identity-js espera entorno Node (usa `global` y `Buffer`),
// pero esta app corre con el builder esbuild de Angular, que no polyrellena globals de Node.
import { Buffer } from 'buffer';

(window as any).global = window;
(window as any).Buffer = Buffer;

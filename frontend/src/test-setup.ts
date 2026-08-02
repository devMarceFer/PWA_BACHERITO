// jsdom no implementa IndexedDB, y Dexie lanza MissingAPIError apenas se instancia.
// fake-indexeddb/auto registra una implementación en memoria sobre globalThis,
// así que dbLocal funciona en las pruebas igual que en el navegador.
import 'fake-indexeddb/auto';

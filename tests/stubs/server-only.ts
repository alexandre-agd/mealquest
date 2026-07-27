// `server-only` lève une erreur dès l'import hors composant serveur, ce qui
// empêche Vitest de charger nos modules serveur. Ce stub le neutralise dans
// les tests uniquement (voir l'alias dans vitest.config.ts) : la protection
// reste entière dans l'application.
export {};

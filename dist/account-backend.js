// Replace this adapter when an authentication service is configured.
// Only a verified session may enable cloud transfer; never store a password here.
export const accountBackend = {
  configured: false,
  async restoreSession() { return null; },
  async signIn(_credentials) { return {status: 'pending', session: null}; },
  async signUp(_credentials) { return {status: 'pending', session: null}; },
  async syncLocal(_request) { return {status: 'pending'}; }
};


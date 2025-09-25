const { Issuer, generators } = require("openid-client");

class OidcAuth {
  constructor(config) {
    this.issuerUrl = config.issuer;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.callbackUrl = config.callbackUrl;
    this.scope = config.scope || "openid profile email";

    if (!this.issuerUrl || !this.clientId || !this.callbackUrl) {
      throw new Error("OIDC configuration is incomplete");
    }

    this.clientPromise = null;
  }

  async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = this.initializeClient();
    }
    return this.clientPromise;
  }

  async initializeClient() {
    const issuer = await Issuer.discover(this.issuerUrl);
    const clientConfig = {
      client_id: this.clientId,
      redirect_uris: [this.callbackUrl],
      response_types: ["code"],
    };

    if (this.clientSecret) {
      clientConfig.client_secret = this.clientSecret;
    }

    return new issuer.Client(clientConfig);
  }

  async createAuthRequest() {
    const client = await this.getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const authorizationUrl = client.authorizationUrl({
      scope: this.scope,
      state,
      nonce,
    });

    return { authorizationUrl, state, nonce };
  }

  async handleCallback(req, { state, nonce }) {
    const client = await this.getClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(this.callbackUrl, params, { state, nonce });
    return tokenSet.claims();
  }
}

module.exports = OidcAuth;

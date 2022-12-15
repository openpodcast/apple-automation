class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

class AuthController {
  // look up authToken in accounts
  getAccountId = function (accounts, authToken) {
    return accounts[authToken];
  };

  getMiddleware = () => {
    return this.handleRequest.bind(this);
  };

  handleRequest = async (req, res, next) => {
    const authToken = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;

    if (
      authToken === undefined ||
      authToken.length < 7 ||
      !authToken.startsWith("Bearer ")
    ) {
      const err = new AuthError("Not authorized");
      return next(err);
    }

    // Read the accounts from the accounts environment variable
    const accounts = JSON.parse(process.env.ACCOUNTS || {});

    // store the user data in the response object (locals is officially made for this)
    // so we can access this data in the backend when it is stored to the database
    res.locals.user = {
      accountId: this.getAccountId(accounts, authToken),
    };

    return next();
  };
}

module.exports = AuthController;

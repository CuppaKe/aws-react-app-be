import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";
import * as process from "process";

class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const authHeader = event.authorizationToken;
    if (!authHeader) {
      throw new AuthError("Unauthorized - Missing Authorization header", 401);
    }

    const token = authHeader.split(" ")[1]; // Extract Base64 token

    if (!token) {
      throw new AuthError("Forbidden - Invalid token format", 403);
    }

    // Decode the Base64 token (username:password)
    const decodedCredentials = Buffer.from(token, "base64").toString("utf-8");
    const [username, password] = decodedCredentials.split(":");

    console.log("Recieved credentials:", username, password);

    if (!username || !password) {
      throw new AuthError("Forbidden - Invalid credentials format", 403);
    }

    // Retrieve stored credentials from environment variables
    const storedPassword = process.env[username];

    console.log("Stored password:", storedPassword);

    if (!storedPassword || storedPassword !== password) {
      throw new AuthError("Forbidden - Invalid username or password", 403);
    }

    console.log("Authorization successful for user:", username);
    return generatePolicy(username, "Allow", event.methodArn);
  } catch (error) {
    console.error("Authorization error:", error);

    return generatePolicy(
      "user",
      "Deny",
      event.methodArn,
      error instanceof AuthError
        ? {
            statusCode: error.statusCode,
            message: error.message,
          }
        : {
            statusCode: 403,
            message: "Internal authorization error",
          }
    );
  }
};

interface AuthorizerContext {
  statusCode?: number;
  message?: string;
}

const generatePolicy = (
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
  context?: AuthorizerContext
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      ...context,
      user: principalId,
    },
  };
};

import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve from this module so startup works from either workspace directory.
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export function readConfig(env) {
  const mongodbUri = env.MONGODB_URI?.trim();
  if (!mongodbUri)
    throw new Error("Missing required environment variable: MONGODB_URI");
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongodbUri)) {
    throw new Error("MONGODB_URI must be a MongoDB connection string");
  }

  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const portText = env.PORT ?? "5000";
  const port = Number(portText);
  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const clientOrigin = env.CLIENT_ORIGIN ?? "http://localhost:5173";
  let url;
  try {
    url = new URL(clientOrigin);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid HTTP(S) origin");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== clientOrigin
  ) {
    throw new Error(
      "CLIENT_ORIGIN must be an HTTP(S) origin without a path or trailing slash",
    );
  }

  return Object.freeze({ nodeEnv, port, mongodbUri, clientOrigin });
}

export const config = readConfig(process.env);

import { RDS_CA_BUNDLE } from "./rds-ca";

/**
 * Postgres TLS settings from DATABASE_SSL:
 *  - "verify"  (production on RDS): encrypted, and the server certificate is verified against
 *               Amazon's RDS root certificates, so a man-in-the-middle can't impersonate the DB.
 *  - "require": encrypted, certificate not verified.
 *  - unset / "false": no TLS (local Docker Postgres).
 */
export function databaseSsl() {
  switch (process.env.DATABASE_SSL) {
    case "verify":
      return { ca: RDS_CA_BUNDLE, rejectUnauthorized: true };
    case "require":
    case "true":
      return "require" as const;
    default:
      return false as const;
  }
}

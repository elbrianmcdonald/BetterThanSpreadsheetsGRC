/**
 * Email Module (Story 4.14)
 *
 * Exports email transport factory and types.
 */

export * from "./types";
export * from "./transportFactory";
export { consoleTransport } from "./consoleTransport";
export { sendgridTransport } from "./sendgridTransport";
export { sesTransport } from "./sesTransport";

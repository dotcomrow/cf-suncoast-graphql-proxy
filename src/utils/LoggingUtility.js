import { GCPLogger } from "npm-gcp-logging";

export default {
  async logEntry(context, entries) {
    var finalEntries = [];
    for (var entry of entries) {
      entry.spanId = context.SpanId;
      entry.labels = {
        environment: context.ENVIRONMENT,
        spanId: context.SpanId,
        user: (context.account) ? context.account.id : "unauthenticated",
        version: context.VERSION,
      }
      finalEntries.push(entry);
    }
    await GCPLogger.logEntry(
      context.GCP_LOGGING_PROJECT_ID,
      context.LOGGING_TOKEN,
      context.LOG_NAME,
      finalEntries
    );
  },

  addSpanId(spanId) {
    return {
      onResponse({ request, response }) {
        response.headers.set('SpanId', spanId);
      }
    }
  }
}

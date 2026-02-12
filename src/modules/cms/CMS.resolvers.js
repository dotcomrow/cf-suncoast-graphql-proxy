import { GCPBigquery } from "npm-gcp-bigquery";
import { serializeError } from "serialize-error";
import { default as LogUtility } from "../../utils/LoggingUtility.js";
import { default as SQL } from "./SQL.js";

export default {
  Query: {
    contentByKey: async (parent, args, context) => {
      try {
        return await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          SQL.content_by_key_query_sql(context, args)
        );
      } catch (error) {
        await LogUtility.logEntry(context, [
          {
            severity: "ERROR",
            jsonPayload: {
              error: serializeError(error),
            },
          },
        ]);
      }
    },
  },
  Mutation: {
    createContent: async (parent, args, context) => {
      try {
        if (context_text["account"] == undefined) {
          return null;
        }
        var id = context_text["account"]["id"];
        args.content.created_by = id;
        args.content.updated_by = id;
        await LogUtility.logEntry(context_text, [
          {
            severity: "INFO",
            jsonPayload: {
              SQL: SQL.create_content_query_sql(context_text, args.content),
              context: context_text,
              args: args,
            },
          },
        ]);
        var res = await GCPBigquery.query(
          context_text.PULSE_DATABASE_PROJECT_ID,
          context_text.DATABASE_TOKEN,
          SQL.create_content_query_sql(context_text, args.content)
        );

        console.log("res", res)
        return res;
      } catch (error) {
        await LogUtility.logEntry(context_text, [
          {
            severity: "ERROR",
            jsonPayload: serializeError(error),
          },
        ]);
      }
    },
  },
};

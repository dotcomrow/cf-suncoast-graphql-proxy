import { GCPBigquery } from "npm-gcp-bigquery";
import { serializeError } from "serialize-error";
import { default as LogUtility } from "../../../utils/LoggingUtility.js";
import { default as SQL } from "./SQL.js";

export default {
  Query: {
    fetchPictureRequests: async (parent, args, context) => {
      try {
        if (context["account"] == undefined) {
          return null;
        }
        var id = context["account"]["id"];

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              sql: SQL.fetch_picture_request_sql(context, id),
              message: "Request query executing",
            },
          },
        ]);

        var res = await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          SQL.fetch_picture_request_sql(context, id)
        );

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              message: "results",
              res: res,
            },
          },
        ]);

        return res;
      } catch (e) {
        await LogUtility.logEntry(context, [
          {
            severity: "ERROR",
            jsonPayload: {
              message: "Fetch picture requests failed",
              error: serializeError(e),
            },
          },
        ]);
        return null;
      }
    },
    fetchPictureRequestById: async (parent, args, context) => {
      try {
        if (context["account"] == undefined) {
          return null;
        }
        var account_id = context["account"]["id"];

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              sql: SQL.fetch_picture_request_by_id_sql(
                context,
                account_id,
                args.request_id
              ),
              message: "Request by ID query executing",
            },
          },
        ]);

        var res = await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          SQL.fetch_picture_request_by_id_sql(
            context,
            account_id,
            args.request_id
          )
        );

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              message: "results",
              res: res,
            },
          },
        ]);

        return res[0];
      } catch (e) {
        await LogUtility.logEntry(context, [
          {
            severity: "ERROR",
            jsonPayload: {
              message: "Fetch picture request by id failed",
              error: serializeError(e),
            },
          },
        ]);
        return null;
      }
    },
    fetchPictureRequestsByBoundingBox: async (parent, args, context) => {
      try {
        const bbox = args.bbox.min_latitude + " " + args.bbox.min_longitude + "," + args.bbox.max_latitude + " " + args.bbox.min_longitude + "," + args.bbox.max_latitude + " " + args.bbox.max_longitude + "," + args.bbox.min_latitude + " " + args.bbox.max_longitude + "," + args.bbox.min_latitude + " " + args.bbox.min_longitude;
        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              sql: SQL.fetch_picture_requests_within_bbox_sql(
                context,
                bbox,
                args.limit,
                args.offset
              ),
              message: "Request by bounding box query executing",
            },
          },
        ]);

        var res = await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          SQL.fetch_picture_requests_within_bbox_sql(
            context,
            bbox,
            args.limit,
            args.offset
          )
        );

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              message: "results",
              res: res,
            },
          },
        ]);

        return res;
      } catch (e) {
        await LogUtility.logEntry(context, [
          {
            severity: "ERROR",
            jsonPayload: {
              message: "Fetch picture requests by bounding box failed",
              error: serializeError(e),
            },
          },
        ]);
        return null;
      }
    },
  },
};

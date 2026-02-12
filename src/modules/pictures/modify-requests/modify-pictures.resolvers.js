import { GCPBigquery } from "npm-gcp-bigquery";
import { serializeError } from "serialize-error";
import { default as LogUtility } from "../../../utils/LoggingUtility.js";
import { default as SQL } from "./SQL.js";
import { default as Fetch_SQL } from "../fetch-requests/SQL.js";
import { v4 as uuidv4 } from "uuid";
import { GraphQLError } from "graphql";
import { default as GeoJSONValidation } from "geojson-validation";

const PictureSaveValidation = async (request) => {
  if (request.direction < 0 || request.direction > 360) {
    return new GraphQLError(
        `Direction must be between 0 and 360. Received: ${request.direction}`
      );
  }

  try {
    JSON.parse(request.location.replace(/'/g, '"'));

    if (
      !GeoJSONValidation.valid(
        JSON.parse(request.location.replace(/'/g, '"'))
      )
    ) {
      return new GraphQLError(
          `Invalid GeoJSON location. Received: ${request.location}`
        );
    }
  } catch (err) {
    return new GraphQLError(
        `Invalid GeoJSON location. Received: ${request.location}`
      );
  }
};

export default {
  Mutation: {
    savePictureRequest: async (parent, args, context) => {
      try {
        if (context["account"] == undefined) {
          return null;
        }
        var id = context["account"]["id"];
        var request = args.request;
        request.account_id = id;
        request.request_id = uuidv4();

        var validation = await PictureSaveValidation(request);
        if (validation) {
          return Promise.reject(validation);
        }

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              sql: SQL.save_picture_request_sql(context, request),
              message: "Request insert executing",
              project_id: context.PULSE_DATABASE_PROJECT_ID,
            },
          },
        ]);

        var res = await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          SQL.save_picture_request_sql(context, request)
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

        await LogUtility.logEntry(context, [
          {
            severity: "DEBUG",
            jsonPayload: {
              sql: Fetch_SQL.fetch_picture_request_by_id_sql(
                context,
                request.account_id,
                request.request_id
              ),
              message: "save inserted request",
              project_id: context.PULSE_DATABASE_PROJECT_ID,
            },
          },
        ]);

        var newRes = await GCPBigquery.query(
          context.PULSE_DATABASE_PROJECT_ID,
          context.DATABASE_TOKEN,
          Fetch_SQL.fetch_picture_request_by_id_sql(
            context,
            request.account_id,
            request.request_id
          )
        );

        return newRes[0];
      } catch (err) {
        await LogUtility.logEntry(context, [
          {
            severity: "ERROR",
            jsonPayload: {
              message: "Request insert failed",
              error: serializeError(err),
            },
          },
        ]);
        return null;
      }
    },
    updatePictureRequest: async (parent, args, context) => {},
    deletePictureRequest: async (parent, args, context) => {},
  },
};

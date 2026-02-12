import { createYoga, createSchema } from "graphql-yoga";
import { serializeError } from "serialize-error";
import resolvers from "./resolvers/resolvers.js";
import loadFileFromBucket from "./schema/loadFileFromBucket.js";
import { buildClientSchema, printSchema } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { GCPAccessToken } from "npm-gcp-token";
import { default as AuthenticationUtility } from "./utils/AuthenticationUtility.js";
import { default as LogUtility } from "./utils/LoggingUtility.js";
import { v4 as uuidv4 } from "uuid";

var schema = undefined;
var yoga = undefined;
var logging_token = undefined;
var database_token = undefined;

export default {
  async fetch(request, env, ctx) {

    if (logging_token == undefined) logging_token = (await new GCPAccessToken(env.GCP_LOGGING_CREDENTIALS).getAccessToken("https://www.googleapis.com/auth/logging.write")).access_token;
    if (database_token == undefined) database_token = (await new GCPAccessToken(env.GCP_BIGQUERY_CREDENTIALS).getAccessToken("https://www.googleapis.com/auth/bigquery")).access_token;

    var yoga_ctx = Object.assign({}, env);
    yoga_ctx['DATABASE_TOKEN'] = database_token;
    yoga_ctx['LOGGING_TOKEN'] = logging_token;

    if (request.headers.get("X-Shared-Secret") == env.GLOBAL_SHARED_SECRET) {
      yoga_ctx['account'] = {
        id: request.headers.get("X-Auth-User"),
        email: request.headers.get("X-Auth-Email"),
        name: request.headers.get("X-Auth-Name"),
        picture: request.headers.get("X-Auth-Profile"),
        groups: JSON.parse(request.headers.get("X-Auth-Groups")),
        provider: request.headers.get("X-Auth-Provider"),
      };
    } else if (request.headers.get("Authorization") != null || request.headers.get("Authorization") != undefined) {
      yoga_ctx['account'] = await AuthenticationUtility.fetchAccountInfo(request.headers.get("Authorization").split(" ")[1]);
    } 

    if (!request.headers.get("SpanId"))
      yoga_ctx['SpanId'] = uuidv4();
    
    if (!schema) {
      var schemaString = await loadFileFromBucket(env, "graphql_schema.json");
      var schemaObj = buildClientSchema(JSON.parse(schemaString));
      var sdlString = printSchema(schemaObj);

      schema = makeExecutableSchema({
        typeDefs: sdlString,
        resolvers: resolvers.resolvers,
        context: env,
      });
    }

    if (!yoga) {
      yoga = createYoga({
        schema,
        context: yoga_ctx,
        logging: "debug",
        cors: {
          origin: env.CORS_DOMAINS,
          credentials: true,
          methods: ["POST"],
        },
        plugins: [LogUtility.addSpanId(yoga_ctx.SpanId)],
      });
    }

    try {
      return yoga(request, yoga_ctx);
    } catch (e) {
      await LogUtility.logEntry(yoga_ctx, [
        {
          severity: "ERROR",
          jsonPayload: {
            error:serializeError(e),
          },
        },
      ]);
      return new Response(JSON.stringify(responseError), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  },
};

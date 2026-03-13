import { parse, OperationTypeNode } from "graphql";

export async function extractGraphQLRequest(request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      query: url.searchParams.get("query") || undefined,
      operationName: url.searchParams.get("operationName") || undefined,
      rawBody: undefined,
    };
  }

  const bodyText = await request.text();
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const payload = JSON.parse(bodyText);
      if (!Array.isArray(payload) && payload && typeof payload === "object") {
        return {
          query: typeof payload.query === "string" ? payload.query : undefined,
          operationName:
            typeof payload.operationName === "string"
              ? payload.operationName
              : undefined,
          rawBody: bodyText,
          jsonPayload: payload,
        };
      }
    } catch (_e) {
      // If body is malformed, pass it through to upstream unchanged.
    }
  }

  if (contentType.toLowerCase().includes("application/graphql")) {
    return {
      query: bodyText,
      operationName: undefined,
      rawBody: bodyText,
    };
  }

  return {
    query: undefined,
    operationName: undefined,
    rawBody: bodyText,
  };
}

function hasPersistedQueryExtension(payload) {
  return Boolean(
    payload &&
      payload.extensions &&
      typeof payload.extensions === "object" &&
      !Array.isArray(payload.extensions) &&
      payload.extensions.persistedQuery &&
      typeof payload.extensions.persistedQuery === "object"
  );
}

export function normalizePersistedQueryPayload(requestDetails) {
  const payload = requestDetails.jsonPayload;
  if (!payload || !hasPersistedQueryExtension(payload)) {
    return requestDetails;
  }

  const query =
    typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return requestDetails;
  }

  const nextPayload = { ...payload };
  const nextExtensions = { ...payload.extensions };
  delete nextExtensions.persistedQuery;

  if (Object.keys(nextExtensions).length === 0) {
    delete nextPayload.extensions;
  } else {
    nextPayload.extensions = nextExtensions;
  }

  return {
    ...requestDetails,
    query: typeof nextPayload.query === "string" ? nextPayload.query : undefined,
    operationName:
      typeof nextPayload.operationName === "string"
        ? nextPayload.operationName
        : undefined,
    rawBody: JSON.stringify(nextPayload),
    jsonPayload: nextPayload,
  };
}

export function evaluateOperation(query, operationName) {
  if (!query || typeof query !== "string") {
    return { isQueryOnly: false };
  }

  try {
    const document = parse(query);
    let selectedOperationCount = 0;

    for (const definition of document.definitions) {
      if (definition.kind !== "OperationDefinition") {
        continue;
      }

      if (
        operationName &&
        definition.name &&
        definition.name.value !== operationName
      ) {
        continue;
      }

      if (operationName && !definition.name) {
        continue;
      }

      selectedOperationCount += 1;
      if (definition.operation !== OperationTypeNode.QUERY) {
        return { isQueryOnly: false };
      }
    }

    return { isQueryOnly: selectedOperationCount > 0 };
  } catch (_e) {
    return { isQueryOnly: false };
  }
}

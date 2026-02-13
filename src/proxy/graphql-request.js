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

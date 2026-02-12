export default {
  insert_request_sql: (context, request) => {
    return (
      "INSERT INTO `" +
      context.PULSE_DATASET +
      ".requests` " +
      "(account_id, request_id, request_url, request_method, request_headers, request_query, request_body, schedule) " +
      "VALUES ('" +
      request.account_id +
      "', '" +
      request.request_id +
      "', '" +
      request.request_url +
      "', '" +
      request.request_method +
      "', JSON '" +
      JSON.stringify(request.request_headers) +
      "', JSON '" +
      JSON.stringify(request.request_query) +
      "', JSON '" +
      JSON.stringify(request.request_body) +
      "', '" +
      request.schedule +
      "')"
    );
  },
  update_request_sql: (context, request) => {
    return (
      "UPDATE `" +
      context.PULSE_DATASET +
      ".requests` " +
      "SET " +
      "request_url = '" +
      request.request_url +
      "', request_method = '" +
      request.request_method +
      "', request_headers = JSON '" +
      JSON.stringify(request.request_headers) +
      "', request_query = JSON '" +
      JSON.stringify(request.request_query) +
      "', request_body = JSON '" +
      JSON.stringify(request.request_body) +
      "', schedule = '" +
      request.schedule +
      "', updated_at = CURRENT_TIMESTAMP() " +
      "WHERE request_id = '" +
      request.request_id +
      "' AND account_id = '" +
      request.account_id +
      "'"
    );
  },
  delete_request_sql: (context, account_id, request_id) => {
    return (
      "DELETE FROM `" +
      context.PULSE_DATASET +
      ".requests` WHERE request_id = '" +
      request_id +
      "' AND account_id = '" +
      account_id +
      "'"
    );
  },
  request_query_sql: (context, account_id) => {
    return (
      "SELECT " +
      "account_id, " +
      "request_id, " +
      "request_url, " +
      "request_method, " +
      "JSON_QUERY_ARRAY(request_headers) as request_headers, " +
      "JSON_QUERY_ARRAY(request_query) as request_query, " +
      "JSON_QUERY_ARRAY(request_body) as request_body, " +
      "schedule, " +
      "UNIX_MILLIS(updated_at) as updated_at " +
      "FROM `" +
      context.PULSE_DATASET +
      ".requests` WHERE account_id = '" +
      account_id +
      "'"
    );
  },
  request_query_by_id_sql: (context, account_id, request_id) => {
    return (
      "SELECT " +
      "account_id, " +
      "request_id, " +
      "request_url, " +
      "request_method, " +
      "JSON_QUERY_ARRAY(request_headers) as request_headers, " +
      "JSON_QUERY_ARRAY(request_query) as request_query, " +
      "JSON_QUERY_ARRAY(request_body) as request_body, " +
      "schedule, " +
      "UNIX_MILLIS(updated_at) as updated_at " +
      "FROM `" +
      context.PULSE_DATASET +
      ".requests` WHERE request_id = '" +
      request_id +
      "' AND account_id = '" +
      account_id +
      "'"
    );
  },
};

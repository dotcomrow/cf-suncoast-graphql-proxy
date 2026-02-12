export default {
    user_query_sql : (context, id) => {
          return "SELECT " +
          "id," +
          "JSON_QUERY_ARRAY(preferences) as preferences," +
          "private_key as privateKey," +
          "public_key as publicKey," +
          "UNIX_MILLIS(updated_at) as updatedAt" +
          "  FROM `" +
          context.PULSE_DATASET +
          ".user_info` WHERE id = '" +
          id +
          "'"
    },
    insert_sql_new : (context, id, privateKey, publicKey) => {
            return "insert into " +
            context.PULSE_DATASET +
            ".user_info (id, preferences, private_key, public_key, updated_at) values ('" +
            id +
            "', JSON '" +
            JSON.stringify([]) +
            "', JSON '" +
            JSON.stringify(privateKey) +
            "', JSON '" +
            JSON.stringify(publicKey) +
            "', CURRENT_TIMESTAMP())"
    },
    update_sql : (context, id, preferences) => {
            return "update " +
            context.PULSE_DATASET +
            ".user_info set preferences = JSON '" +
            JSON.stringify(preferences) +
            "', updated_at = CURRENT_TIMESTAMP() where id = '" +
            id +
            "'";
    }
}
export default {
  content_by_key_query_sql: function (context, args) {
    return `SELECT
        key,
        group_key,
        language,
        version,
        content_text,
        created_by,
        updated_by,
        UNIX_MILLIS(created_at) as created_at,
        UNIX_MILLIS(updated_at) as updated_at
        FROM ${context.PULSE_DATASET}.content WHERE key = '${args.key}'`;
  },
  create_content_query_sql: function (context, args) {
    return `INSERT INTO ${context.PULSE_DATASET}.content 
        (key, 
        group_key, 
        language, 
        version, 
        content_text, 
        created_by, 
        created_at, 
        updated_by, 
        updated_at) 
        VALUES 
        ('${args.key}', 
        '${args.group_key}', 
        '${args.language}', 
        '${args.version}', 
        '${args.content_text}', 
        '${args.created_by}', 
        CURRENT_TIMESTAMP(), 
        '${args.updated_by}', 
        CURRENT_TIMESTAMP())`;
  },
};

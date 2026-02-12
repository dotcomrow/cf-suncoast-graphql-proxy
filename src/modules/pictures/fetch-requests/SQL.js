export default {
    fetch_picture_request_sql: (context, id) => {
        return `SELECT 
                account_id,
                request_id,
                UNIX_MILLIS(updated_at) as updated_at,
                location,
                direction,
                UNIX_MILLIS(capture_timestamp) as capture_timestamp 
                FROM ${context.PULSE_DATASET}.picture_requests WHERE account_id = '${id}'`;
    },
    fetch_picture_request_by_id_sql: (context, account_id, request_id) => {
        return `SELECT 
                account_id,
                request_id,
                UNIX_MILLIS(updated_at) as updated_at,
                location,
                direction,
                UNIX_MILLIS(capture_timestamp) as capture_timestamp 
                FROM ${context.PULSE_DATASET}.picture_requests WHERE request_id = '${request_id}' AND account_id = '${account_id}'`;
    },
    fetch_picture_requests_within_bbox_sql: (context, bbox, limit, offset) => {
        return `SELECT 
                (select count(*) from ${context.PULSE_DATASET}.picture_requests WHERE ST_WITHIN(location, ST_GEOGFROMTEXT('POLYGON((${bbox}))'))) as total,
                account_id,
                request_id,
                UNIX_MILLIS(updated_at) as updated_at,
                location,
                direction,
                UNIX_MILLIS(capture_timestamp) as capture_timestamp,
                request_title,
                request_description,
                bid_type 
                FROM ${context.PULSE_DATASET}.picture_requests WHERE ST_WITHIN(location, ST_GEOGFROMTEXT('POLYGON((${bbox}))')) limit ${limit} offset ${offset}`;
    },
};
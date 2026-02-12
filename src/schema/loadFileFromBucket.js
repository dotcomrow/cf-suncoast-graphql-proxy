const loadFileFromBucket = async (env, schemaFile) => {
  
    if (env.SCHEMAS_BUCKET != undefined) {
        const object = await env.SCHEMAS_BUCKET.get(schemaFile);
        if (object == null) return defaultGraphQL();
        let text = await new Response(object.body).text();
        return text;
    } else {
        return defaultGraphQL();
    }
}

const defaultGraphQL = () => {
    return "type Query { hello: String! }";
}

export default loadFileFromBucket;
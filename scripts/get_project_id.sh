curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz

tar -xf google-cloud-cli-linux-x86_64.tar.gz

./google-cloud-sdk/install.sh

printf '%s' "$GOOGLE_CREDENTIALS" > key.json

./google-cloud-sdk/bin/gcloud auth activate-service-account --key-file=key.json

PROJECT_ID=$(./google-cloud-sdk/bin/gcloud projects list --format json --filter name="${project}" | jq -r '.[0].projectId')

echo $PROJECT_ID > project_id_tmp

tr -cd '[:print:]' < project_id_tmp > project_id

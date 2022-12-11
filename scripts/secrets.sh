echo "Getting secret variables"

find -type f -name '*.env*' -delete

echo "VITE_API_URL=http://raineworks.com/api" >> apps/web/.env

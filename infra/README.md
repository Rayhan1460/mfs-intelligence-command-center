# Infrastructure Foundation

The root `docker-compose.yml` defines the local FastAPI service and PostgreSQL image with PostGIS extensions available. Persistent database state uses a named Docker volume. No production credentials, cloud resources, or source data are configured here.
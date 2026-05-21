FROM osrm/osrm-backend:v5.27.1

# Install curl and dos2unix to sanitize line endings of the entrypoint script
RUN apt-get update && apt-get install -y curl dos2unix && rm -rf /var/lib/apt/lists/*

# Copy custom stroller profile
COPY stroller.lua /opt/stroller.lua

# Copy and set up the startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN dos2unix /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

WORKDIR /data

ENTRYPOINT ["/docker-entrypoint.sh"]

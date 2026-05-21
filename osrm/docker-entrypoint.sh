#!/bin/bash
set -e

DATA_PATH="/data/kanto-latest"
PBF_FILE="${DATA_PATH}.osm.pbf"
OSRM_FILE="${DATA_PATH}.osrm"

# Check if pre-processed OSRM files exist
if [ ! -f "$OSRM_FILE" ]; then
    echo "=== OSRM data not found. Initializing... ==="
    
    # 1. Download Kanto map data from Geofabrik
    echo "Downloading Kanto OSM data (~350MB)..."
    curl -L -o "$PBF_FILE" https://download.geofabrik.de/asia/japan/kanto-latest.osm.pbf
    
    # 2. Extract with custom stroller profile
    echo "Extracting map data with stroller profile..."
    osrm-extract -p /opt/stroller.lua "$PBF_FILE"
    
    # 3. Partition
    echo "Partitioning map data..."
    osrm-partition "$OSRM_FILE"
    
    # 4. Customize
    echo "Customizing map data..."
    osrm-customize "$OSRM_FILE"
    
    # Clean up raw PBF to save space
    echo "Cleaning up temporary PBF file..."
    rm -f "$PBF_FILE"
    
    echo "=== OSRM data build completed successfully! ==="
else
    echo "=== Found existing pre-processed OSRM data. Skipping build. ==="
fi

# Start OSRM routed server
echo "Starting OSRM server on port 5000..."
exec osrm-routed --algorithm mld --ip 0.0.0.0 --port 5000 "$OSRM_FILE"

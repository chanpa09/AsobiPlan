-- Stroller OSRM profile. Extends the default foot profile to avoid stairs and bad surfaces.

-- Add default profiles path to package search path so we can require foot.lua
package.path = package.path .. ";/opt/profiles/?.lua"

local foot = require("foot")

-- Store the original way processing function
local original_process_way = process_way

-- Override process_way to apply stroller specific constraints
function process_way(profile, way, result)
  local highway = way:get_value("highway")
  
  -- 1. STRICT STEPS AVOIDANCE
  if highway == "steps" then
    -- Do not set speed, which means it won't be routable
    return
  end

  -- Call the original foot profile processing
  original_process_way(profile, way, result)

  -- 2. SURFACE PENALTIES (Rough surfaces are hard to push a stroller on)
  local surface = way:get_value("surface")
  if surface then
    if surface == "cobblestone" or surface == "gravel" or surface == "sand" or surface == "unpaved" or surface == "pebblestone" then
      -- Penalize speed by 70% (slow down to crawl, making router prefer paved paths)
      if result.forward_speed > 0 then
        result.forward_speed = result.forward_speed * 0.3
      end
      if result.backward_speed > 0 then
        result.backward_speed = result.backward_speed * 0.3
      end
    end
  end

  -- 3. SMOOTH PAVEMENT PREFERENCE
  if surface == "asphalt" or surface == "paved" or surface == "concrete" then
    -- Slightly boost speed/preference for optimal paths
    if result.forward_speed > 0 then
      result.forward_speed = result.forward_speed * 1.2
    end
    if result.backward_speed > 0 then
      result.backward_speed = result.backward_speed * 1.2
    end
  end

  -- 4. INCLINE PENALTIES (Steep roads are hard to push a stroller on)
  local incline = way:get_value("incline")
  if incline then
    local pct = nil
    if incline == "up" or incline == "down" then
      pct = 8 -- assume moderate-steep incline
    else
      -- try to parse numeric percentage (e.g., "12%" -> 12, "0.12" -> 12, etc.)
      local val = incline:gsub("%%", "")
      local num = tonumber(val)
      if num then
        if num < 1 and num > -1 and num ~= 0 then
          pct = math.abs(num * 100)
        else
          pct = math.abs(num)
        end
      end
    end
    
    if pct then
      if pct > 10 then
        -- steep incline: penalize speed by 80%
        if result.forward_speed > 0 then result.forward_speed = result.forward_speed * 0.2 end
        if result.backward_speed > 0 then result.backward_speed = result.backward_speed * 0.2 end
      elseif pct > 5 then
        -- moderate incline: penalize speed by 30%
        if result.forward_speed > 0 then result.forward_speed = result.forward_speed * 0.7 end
        if result.backward_speed > 0 then result.backward_speed = result.backward_speed * 0.7 end
      end
    end
  end
end

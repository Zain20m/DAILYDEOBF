-- DAILYDEOBF Roblox Environment Logger
-- Read-only diagnostics for a Roblox experience you own or are authorized to test.
-- This script prints locally to the Roblox Studio Output window. It makes no network
-- requests, does not inspect executor globals, and does not collect credentials.

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")
local HttpService = game:GetService("HttpService")

local function safeRead(callback)
    local ok, value = pcall(callback)
    if ok then
        return value
    end
    return "Unavailable: " .. tostring(value)
end

local function enumName(value)
    return safeRead(function()
        return tostring(value)
    end)
end

local function vectorSummary(value)
    return safeRead(function()
        return string.format("%.2f, %.2f, %.2f", value.X, value.Y, value.Z)
    end)
end

local function vector2Summary(value)
    return safeRead(function()
        return string.format("%.2f, %.2f", value.X, value.Y)
    end)
end

local function colorSummary(value)
    return safeRead(function()
        return string.format("%.3f, %.3f, %.3f", value.R, value.G, value.B)
    end)
end

local function serviceStatus(name)
    local ok, service = pcall(function()
        return game:GetService(name)
    end)
    if not ok or not service then
        return "Unavailable"
    end
    return service.ClassName .. " (available)"
end

local player = Players.LocalPlayer
local camera = Workspace.CurrentCamera

local report = {
    logger = {
        name = "DAILYDEOBF Roblox Environment Logger",
        version = "1.0",
        timestampUtc = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        mode = safeRead(function()
            if RunService:IsStudio() then
                return "Roblox Studio"
            elseif RunService:IsClient() then
                return "Roblox client"
            elseif RunService:IsServer() then
                return "Roblox server"
            end
            return "Unknown"
        end),
    },

    experience = {
        gameId = safeRead(function() return game.GameId end),
        placeId = safeRead(function() return game.PlaceId end),
        placeVersion = safeRead(function() return game.PlaceVersion end),
        creatorType = safeRead(function() return enumName(game.CreatorType) end),
        creatorId = safeRead(function() return game.CreatorId end),
        privateServer = safeRead(function() return game.PrivateServerId ~= "" end),
        loaded = safeRead(function() return game:IsLoaded() end),
    },

    runtime = {
        isStudio = safeRead(function() return RunService:IsStudio() end),
        isClient = safeRead(function() return RunService:IsClient() end),
        isServer = safeRead(function() return RunService:IsServer() end),
        isRunning = safeRead(function() return RunService:IsRunning() end),
        localPlayerAvailable = player ~= nil,
        characterLoaded = player ~= nil and player.Character ~= nil,
        characterHasHumanoid = player ~= nil and player.Character ~= nil
            and player.Character:FindFirstChildOfClass("Humanoid") ~= nil,
    },

    workspace = {
        className = safeRead(function() return Workspace.ClassName end),
        childCount = safeRead(function() return #Workspace:GetChildren() end),
        gravity = safeRead(function() return Workspace.Gravity end),
        fallenPartsDestroyHeight = safeRead(function() return Workspace.FallenPartsDestroyHeight end),
        streamingEnabled = safeRead(function() return Workspace.StreamingEnabled end),
        currentCameraAvailable = camera ~= nil,
        cameraType = camera and safeRead(function() return enumName(camera.CameraType) end) or "Unavailable",
        cameraFieldOfView = camera and safeRead(function() return camera.FieldOfView end) or "Unavailable",
        cameraViewportSize = camera and safeRead(function() return vector2Summary(camera.ViewportSize) end) or "Unavailable",
    },

    lighting = {
        clockTime = safeRead(function() return Lighting.ClockTime end),
        brightness = safeRead(function() return Lighting.Brightness end),
        globalShadows = safeRead(function() return Lighting.GlobalShadows end),
        fogStart = safeRead(function() return Lighting.FogStart end),
        fogEnd = safeRead(function() return Lighting.FogEnd end),
        ambient = safeRead(function() return colorSummary(Lighting.Ambient) end),
        outdoorAmbient = safeRead(function() return colorSummary(Lighting.OutdoorAmbient) end),
        technology = safeRead(function() return enumName(Lighting.Technology) end),
    },

    services = {},
}

local serviceNames = {
    "Workspace",
    "Players",
    "Lighting",
    "ReplicatedStorage",
    "ReplicatedFirst",
    "ServerStorage",
    "ServerScriptService",
    "StarterGui",
    "StarterPack",
    "StarterPlayer",
    "SoundService",
    "TextChatService",
    "TweenService",
    "RunService",
    "UserInputService",
    "ContextActionService",
    "CollectionService",
    "HttpService",
    "Stats",
}

for _, serviceName in ipairs(serviceNames) do
    report.services[serviceName] = serviceStatus(serviceName)
end

report.performance = {
    totalMemoryMb = safeRead(function()
        return game:GetService("Stats"):GetTotalMemoryUsageMb()
    end),
}

local encoded = safeRead(function()
    return HttpService:JSONEncode(report)
end)

print("========== DAILYDEOBF ENVIRONMENT LOGGER: BEGIN ==========")
if type(encoded) == "string" then
    print(encoded)
else
    warn("Could not encode the diagnostic report: " .. tostring(encoded))
end
print("=========== DAILYDEOBF ENVIRONMENT LOGGER: END ===========")
print("Report was printed locally. No data was uploaded.")

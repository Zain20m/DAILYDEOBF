-- DAILY DEOBF · opt-in runtime HTTP spy
-- Use only in your own Roblox test place.
-- Route requests through this wrapper to log method, sanitized URL,
-- status and elapsed time. Response bodies and headers are never logged.

local HttpSpy = {}

local function safeUrl(raw)
    local value = tostring(raw or "<unknown>")
    value = value:gsub("([?&][^=]+)=([^&]*)", "%1=[redacted]")
    value = value:gsub("://[^/@]+:[^/@]+@", "://[redacted]@")
    return value
end

local function emit(logger, method, url, status, elapsed)
    local line = string.format(
        "[HTTP-SPY] %s %s | status=%s | %.1fms",
        tostring(method),
        safeUrl(url),
        tostring(status or "unknown"),
        tonumber(elapsed) or 0
    )
    if typeof(logger) == "function" then
        pcall(logger, line)
    else
        print(line)
    end
end

function HttpSpy.new(httpService, logger)
    assert(httpService, "HttpSpy.new requires HttpService")

    local spy = {}

    function spy:RequestAsync(options)
        assert(type(options) == "table", "RequestAsync expects an options table")
        local method = tostring(options.Method or "GET"):upper()
        local url = options.Url or options.URL or "<unknown>"
        local started = os.clock()
        local ok, result = pcall(function()
            return httpService:RequestAsync(options)
        end)
        local elapsed = (os.clock() - started) * 1000
        local status = ok and result and result.StatusCode or "error"
        emit(logger, method, url, status, elapsed)
        if not ok then error(result, 0) end
        return result
    end

    function spy:GetAsync(url, noCache, headers)
        return self:RequestAsync({
            Url = url,
            Method = "GET",
            Headers = headers,
        })
    end

    function spy:PostAsync(url, body, contentType, compress, headers)
        return self:RequestAsync({
            Url = url,
            Method = "POST",
            Body = body,
            Headers = headers,
            ContentType = contentType,
            Compress = compress,
        })
    end

    return spy
end

return HttpSpy

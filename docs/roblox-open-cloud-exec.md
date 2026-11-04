# Roblox Open Cloud .exec setup

The .exec command uses Roblox's official Open Cloud Luau Execution API. It runs Luau headlessly inside the configured Roblox place. It is not a client injector and does not attach to a running player's client.

## Configure Railway variables

Set these on the DAILY DEOBF Railway service:

- ROBLOX_OPEN_CLOUD_API_KEY: your Roblox Open Cloud API key. Never paste this into Discord or commit it to GitHub.
- ROBLOX_EXEC_UNIVERSE_ID: numeric universe ID for a dedicated test experience.
- ROBLOX_EXEC_PLACE_ID: numeric place ID inside that test experience.
- ROBLOX_EXEC_ALLOWED_USERS: comma-separated Discord user IDs allowed to run .exec.
- ROBLOX_EXEC_TIMEOUT_SECONDS: optional, 1-300; defaults to 30.

Create the API key with the Luau Execution permission for only the test experience/place you intend to use. Keep the key in Railway's private Variables panel.

## Use

Send source inline:

    .exec print(game:GetService("Workspace").Name)

Or attach a .lua, .luau, or .txt file:

    .exec

The bot submits the task, polls until it finishes, and returns return values and execution logs in roblox-execution-result.txt.

## Important

Use a dedicated test place, not a production experience. The task runs with the place's Roblox DataModel and can change game state. Only allowlist trusted Discord accounts. Roblox documents a maximum task duration of 300 seconds and a maximum of 10 concurrent tasks per place; this bot also limits each local task to the configured timeout.

This API does not provide an exploit executor for other people's live clients. Client-only executor APIs such as getgenv, newcclosure, writefile, and exploit-only HttpGet are not supplied by Open Cloud. Scripts that depend on those APIs will not work as-is.

# data

Proxies blob files from Azure Blob Storage to the browser using Managed Identity authentication.

## Endpoint

`GET /api/data/{filename}`  
`HEAD /api/data/{filename}`

## Parameters

| Parameter | Description |
|---|---|
| `{filename}` | Blob name to retrieve from the configured container |
| `?demo=true` | Read from the `demo_data/` prefix instead of the container root |

## Behaviour

The function retrieves the blob using a Managed Identity credential and streams the bytes back to the caller. Content-Type is derived from the blob's stored metadata or inferred from the file extension.

This endpoint is only called when the storage account has anonymous blob access disabled. When anonymous access is enabled, the frontend reads blobs directly without going through this function.

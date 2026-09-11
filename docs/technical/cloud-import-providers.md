# Cloud import provider boundary

PLAT-081 keeps provider-specific storage APIs behind
`CloudImportProvider` in `@tahti/shared`. A provider implementation must:

- list provider-owned file metadata in bounded pages;
- return a web `ReadableStream` with trusted provider metadata for one file;
- revoke an OAuth token when the host disconnects the provider.

The host owns OAuth redirects, encrypted credential persistence, refresh-token
rotation, import-job persistence, MinIO object keys, and transcode scheduling.
Provider implementations receive a short-lived access token for each call and
must not retain it. Workers must validate the provider's returned MIME type and
filename before persisting a stream.

Google Drive is the first implementation. The existing Google Picker remains
the user-facing file selector because it provides Google's `drive.file`
least-privilege consent flow. The provider's `listFiles` method exists for hosts
that need server-side selection and for compatibility with future providers;
it does not expand the current Picker permissions.

## Adding another provider

1. Implement `CloudImportProvider` and add provider-specific OAuth/session
   handling in the API.
2. Store encrypted credentials on the owning user or in a provider connection
   table. Never put credentials in BullMQ job payloads.
3. Queue only the provider ID, external file ID, and display metadata.
4. In the worker, resolve a fresh access token, call `getDownloadStream`, validate
   the returned file, stream it directly to MinIO, and enqueue the normal
   transcode job.
5. Revoke the remote token before clearing the local connection when supported;
   local deletion must still succeed if the provider is unavailable.

## WebDAV and Open Cloud Mesh assessment

WebDAV is the practical fallback for self-hosted Nextcloud and similar storage.
It maps cleanly to listing and streaming, but it usually uses a server URL plus
an app password rather than OAuth. A future implementation should therefore
keep authentication outside `CloudImportProvider` and exchange the stored
connection for a short-lived or request-scoped authorization value before each
call. URL validation must block loopback, link-local, and private network targets
to prevent SSRF from worker nodes.

Open Cloud Mesh is a sharing and federation protocol rather than a general
replacement for provider file APIs. It may be useful later for importing a
specific share, but it does not remove the need for WebDAV or a vendor API for
browsing a user's files. It should be added as a separate provider only when a
real partner deployment supplies an interoperability target and test fixtures.
